// N64 raw section model -> shared IR (targeting BCSEQ). The semantic bridge.
//
// Mapping (documented — the N64 and 3DS models don't line up 1:1):
//   - One BCSEQ track per distinct N64 CHANNEL NUMBER. N64 channel numbers are 0..15,
//     so this always fits BCSEQ's 16-track limit — even when a sequence has far more
//     note *layers* than 16 (layers overlap for polyphony) or re-points a channel over
//     time (an intro `ldchan` then a main-loop `ldchan` to the same slot; those loads
//     are concatenated into the one track).
//   - Each channel's layers are resolved to flat note timelines (loops unrolled by
//     their counts, jumps/calls followed) and MERGED onto one timeline. They are then
//     emitted with NoteWait OFF: notes starting at the same tick are stacked
//     back-to-back and an explicit Wait advances time — the exact idiom a real
//     multi-track .bcseq uses for polyphony. This trades N64 loop *structure* for a
//     single mergeable timeline (necessary to combine overlapping layers).
//   - Track 0 doubles as conductor: sequence-level setup (AllocateTrack + an OpenTrack
//     per other track, Tempo, MainVolume) precedes its own channel's content.
//   - Bank switching is decided by a single program router (src/n64/banks.js,
//     makeProgramRouter): a raw N64 program -> { bank: cmeta bank INDEX (0..3), program }.
//     Chiptune waves (N64 0x80..0x87, present in every bank) live in a separate 3DS bank,
//     reached via BankSelect (index 1 for melodic banks, index 3 for the SFX bank 0x00),
//     instrument from the fixed chiptune table. The N64 SFX bank 0x00 is split across four
//     3DS banks, so its programs route to indices 0..3 per the doc table. Every other bank
//     keeps its programs on its main bank (index 0) via remapProgram. A track only emits a
//     BankSelect when its needed index changes (none if it never leaves its main bank).
//   - Channel control maps: instrument -> ProgramChange, vol -> Volume, pan -> Pan,
//     pitch bend (bend/bendfine) -> PitchBend (+ a BendRange), vibrato (vibdepth/vibfreq/
//     vibdelay/vibreset) -> the 3DS Mod* LFO (ModType pitch + ModDepth/ModSpeed/ModDelay);
//     transposition (seq + channel + layer) is baked into note keys. Instrument, volume,
//     bend, pan and vibrato all ride the channel timeline, so mid-stream switches / ramps /
//     sweeps carry over (not just the first/last value) — e.g. a continuous pan sweep.
//     Vibrato has NO byte-exact oracle (real .bcseq files use no Mod*) and its extent also
//     depends on the soundfont, so its value mapping (VIB_* constants) is approximate.
//   - A channel that NEVER assigns an instrument (no instr/font/fontinstr on the
//     channel and no instr on a layer) is MUTED — dropped entirely, matching N64 (which
//     leaves it silent) instead of letting 3DS fall back to a default program.
//   - Conditional branches (beqz/bltz/bgez) are resolved as "not taken", and
//     IO/dyntable/rand/effect opcodes are ignored — no musical BCSEQ equivalent.
//
// Instrument/drum remap (off unless a bank/kit is given):
//   - opts.remapProgram(program) -> program : bank/instrument index remap.
//   - opts.remapDrumKey(key) -> key : drum-channel note-key remap (or set opts.drumKit,
//     or let it default to opts.bank's kit; applied only to drum channels 0x7F).
//   - opts.fixLoops(sequence) -> sequence : optional post-pass over the built IR.
//
// Panning: N64 defaults an unset channel pan to CENTER (64); 3DS defaults to hard LEFT.
// Every track therefore emits an explicit Pan (the value at tick 0, or 64 when unset);
// any later pan changes ride the timeline so pan sweeps are reproduced.
//
// Looping is intrinsic, taken from the .seq (NOT a user option): if the seq section
// ends in a backward `jump`, each track loops with a `Jump` back to a label at the loop
// point (the intro before it plays once); all tracks are padded to the master period so
// they stay in sync. A seq that ends with `end` plays once — and there too every track is
// padded to the sequence's total duration (the seq track's `end` tick), because on 3DS the
// whole sequence stops when the SHORTEST track hits Fin; without the pad a short track cut
// the longer ones off early (fanfares). (See resolveSeqTimeline / emitTrack.)
//
// Timebase: N64 delays are tatums (48/beat). If opts.bcseqTimebase differs from
// opts.n64Timebase (both default 48), every delay/duration is scaled and a Timebase
// command is emitted on track 0.

import { Sequence } from '../ir/events.js';
import { orderedCmds } from './reader.js';
import { makeDrumKeyRemap, drumKitForBank } from './drums.js';
import { N64_DRUM_PROGRAM, DEFAULT_BANK, makeProgramRouter } from './banks.js';

const MIDI_A0 = 21; // N64 pitch index 0 == PITCH_A0 == MIDI note 21.
const MAX_TRACKS = 16; // BCSEQ hard cap (u16 track mask, track 0 implicit).
const STEP_BUDGET = 200000; // guard against unbounded layer self-loops.
// N64 pitch-bend ranges (semitones). `bend` (0xD3) indexes a one-OCTAVE frequency
// table; `bendfine` (0xEE) a one-SEMITONE table. Both are linear in semitones over the
// s8 arg, so they map to 3DS PitchBend (s8 over +/-BendRange semitones) 1:1 once the
// track's BendRange is set to the range in use.
const BEND_RANGE_OCTAVE = 12;
const BEND_RANGE_SEMITONE = 1;

// Vibrato -> 3DS Mod* LFO. There is NO byte-exact oracle for this (none of the real
// OoT3D .bcseq files use Mod* at all), and the N64 vibrato extent also depends on the
// instrument's soundfont, so these are deliberately conservative, easily-tuned
// approximations — calibrate by ear in game if the wobble is too weak/strong/fast.
const MOD_TYPE_PITCH = 0;   // 3DS ModType 0 = modulate pitch (vibrato)
const VIB_DEPTH_SCALE = 4;  // N64 vibdepth (u8, typically ~10-20) -> 3DS ModDepth (u8)
const VIB_FREQ_SCALE = 1;   // N64 vibfreq -> 3DS ModSpeed (best-guess 1:1)
const VIB_DEFAULT_SPEED = 16; // 3DS ModSpeed when a channel sets vibdepth but no vibfreq

/**
 * @param {ReturnType<import('./reader.js').read>} model raw N64 model
 * @param {object} [opts]
 * @param {number} [opts.bank] OoT bank id — also selects the drum kit (its 0x7F slot)
 * @param {(program:number)=>number} [opts.remapProgram]
 * @param {(key:number)=>number} [opts.remapDrumKey]
 * @param {string} [opts.drumKit] drum-kit id (overrides the bank's default)
 * @param {(seq:Sequence)=>Sequence} [opts.fixLoops] optional post-pass over the IR
 * @param {number} [opts.n64Timebase] tatums per beat in the source (default 48)
 * @param {number} [opts.bcseqTimebase] ticks per beat in the target (default 48)
 * @returns {Sequence}
 */
export function toIr(model, opts = {}) {
  const remapProgram = opts.remapProgram || ((p) => p);
  // Program router: raw N64 program -> { bank: BankSelect index, program }. Folds chiptune
  // routing and the SFX bank-0x00 split in on top of the main-bank remapProgram.
  const routeProgram = makeProgramRouter(opts.bank, remapProgram);
  // Drum-channel note-key remap: explicit hook wins, else the kit (named directly or
  // taken from the bank's 0x7F slot), else no-op. Applied only to drum channels 0x7F.
  const drumKit = opts.drumKit || (opts.bank != null ? drumKitForBank(opts.bank) : null);
  const remapDrumKey = opts.remapDrumKey || (drumKit ? makeDrumKeyRemap(drumKit) : null);
  const n64Timebase = opts.n64Timebase != null ? opts.n64Timebase : 48;
  const bcseqTimebase = opts.bcseqTimebase != null ? opts.bcseqTimebase : 48;
  const scale = bcseqTimebase / n64Timebase;
  const scaleTicks = (t) => Math.max(0, Math.round(t * scale));

  const seqTranspose = collectSeqTranspose(model.seq);
  const seqVol = firstArg(model.seq, 'vol');
  const seqTl = resolveSeqTimeline(model.seq);
  const seqTempos = seqTl.tempos;
  // Looping is carried over from the .seq itself (its seq-section backward jump), not a
  // user choice: if the seq loops, `loop` gives the loop-START tick (the intro before
  // it plays once) and the master period `len` (every track is padded to it so their
  // per-track `Jump` loops stay in sync). No backward jump -> no looping (plays once).
  const loop = seqTl.hasLoop ? { start: seqTl.loopStartTick, len: seqTl.loopLen } : null;

  // Group channel loads by channel number (first-seen order), one track each. Drop
  // groups that never assign an instrument (silent on N64 — see groupHasProgram); if
  // that would leave nothing, keep them all rather than emit an empty sequence.
  const allGroups = groupByChannelNumber(model.channels);
  const withProgram = allGroups.filter(groupHasProgram);
  const groups = withProgram.length ? withProgram : allGroups;

  const seq = new Sequence();
  const push = (ev) => seq.push(ev);

  // --- Track 0 header (conductor). ---
  if (groups.length > 1) {
    push(cmd('AllocateTrack', { mask: (1 << groups.length) - 1 }));
    for (let i = 1; i < groups.length; i++) {
      push(cmd('OpenTrack', { track: i, offset: trackLabel(i) }));
    }
  }
  if (scale !== 1) push(cmd('Timebase', { value: bcseqTimebase & 0xff }));
  if (seqVol != null) push(cmd('MainVolume', { value: seqVol }));

  // --- Emit each track's body. Tempo changes ride on track 0 (the conductor). A track
  // that looped gets `Jump loopN` (back to its loop label at the loop-start tick) before
  // the terminating Fin, matching the real .bcseq per-track loop idiom. ---
  for (let i = 0; i < groups.length; i++) {
    if (i > 0) push({ type: 'Label', name: trackLabel(i) });
    const loopLabel = loop ? 'loop' + i : null;
    const looped = emitTrack(push, groups[i], seqTranspose, routeProgram, remapDrumKey, scaleTicks, i === 0 ? seqTempos : null, loop, loopLabel, seqTl.loopLen);
    if (looped) push(cmd('Jump', { offset: loopLabel }));
    push(cmd('Fin', {}));
  }
  if (groups.length === 0) push(cmd('Fin', {})); // empty but valid

  return opts.fixLoops ? opts.fixLoops(seq) : seq;
}

/**
 * Group channel loads by their channel number, preserving first-seen order and
 * capping at BCSEQ's 16 tracks.
 * @returns {{num:number, loads:object[]}[]}
 */
function groupByChannelNumber(channels) {
  const byNum = new Map();
  const order = [];
  for (const ch of channels) {
    if (!byNum.has(ch.num)) { byNum.set(ch.num, []); order.push(ch.num); }
    byNum.get(ch.num).push(ch);
  }
  return order.slice(0, MAX_TRACKS).map((num) => ({ num, loads: byNum.get(num) }));
}

/**
 * Whether a channel-number group ever assigns an instrument, across ALL its loads (a
 * re-pointed channel may set `instr` in its intro load and inherit it in the loop load)
 * and their layers. A group with none is silent on N64 — the audio driver plays notes
 * with no sample — so it must be muted rather than emitted (3DS would otherwise sound a
 * default program). Checks `instr`/`fontinstr` on the channel and `instr` on any layer.
 * @param {{num:number, loads:object[]}} group
 * @returns {boolean}
 */
function groupHasProgram(group) {
  for (const load of group.loads) {
    for (const c of load.region.cmds.values()) {
      if (c.name === 'instr' || c.name === 'fontinstr') return true;
    }
    for (const layer of load.layers) {
      for (const c of layer.region.cmds.values()) if (c.name === 'instr') return true;
    }
  }
  return false;
}

/**
 * Emit one track: a channel-control prefix followed by one merged, timeline-ordered
 * stream of the channel's notes, its volume changes, and (for track 0) the sequence's
 * tempo changes — all across every load of this channel number.
 * @param {(program:number)=>{bank:number, program:number}} routeProgram program router
 *   (raw N64 program -> BankSelect index + instrument; see makeProgramRouter)
 * @param {((key:number)=>number)|null} remapDrumKey drum-note key remap, or null
 * @param {number[]} tempos conductor tempo events `{tick,value}` (track 0 only; else null)
 * @param {{start:number,len:number}|null} loop loop-start tick + master period, or null
 * @param {string|null} loopLabel name for this track's loop label (when looping)
 * @param {number} masterEnd the sequence's total duration in source ticks (the seq
 *   track's clock at `end`); a non-looping track is padded to it so it does not `Fin`
 *   before the others and cut the sequence off early (see the padding at the tail)
 * @returns {boolean} whether this track looped (a loop label + Jump are warranted)
 */
function emitTrack(push, group, seqTranspose, routeProgram, remapDrumKey, scaleTicks, tempos, loop, loopLabel, masterEnd) {
  const control = collectChannelControl(group.loads[0].region);
  // Drum channels (N64 program 0x7F) index a reordered 3DS drum kit. When a kit is
  // active, remap the RAW note key (percussion keys index a sample table, so transpose
  // does not apply — build note keys without it). Detection uses the RAW program.
  const converting = control.program === N64_DRUM_PROGRAM && remapDrumKey != null;
  const mapKey = converting ? remapDrumKey : (k) => k;

  // Build one timed event list, merging across the channel's loads. Re-pointed loads
  // (intro then main) are laid end to end via segBase. Each load's length and its
  // layers' start offsets come from the CHANNEL script's own timeline (its delays /
  // ldlayer positions), not just the layer note lengths — a load may be a layer-less
  // intro (e.g. `instr; delay 288; end`) whose 288-tick delay must still advance the
  // clock, or it may load a layer partway through the channel. Volume, instrument and
  // pitch-bend commands ride the same channel timeline (a vol ramp is
  // `vol; cdelay; vol; …`; a sweep is `bend; cdelay; bend; …`) so they stay
  // time-accurate. `order` puts control changes before notes at the same tick.
  const events = []; // {tick, order, ev?} | {tick, order, note:{key,vel,dur}}
  const programEntries = []; // {tick, value} raw N64 instrument (instr) changes
  const bendEntries = [];    // {tick, value, range} raw N64 pitch bends
  const panEntries = [];     // {tick, value} raw N64 channel pans
  const vibEntries = [];     // {tick, kind, value} raw N64 vibrato control
  let segBase = 0;
  for (const load of group.loads) {
    const base = seqTranspose + (collectChannelControl(load.region).transpose || 0);
    const chTl = resolveChannelTimeline(load.region);
    for (const v of chTl.vols) {
      events.push({ tick: segBase + v.tick, order: 0, ev: cmd('Volume', { value: v.value & 0xff }) });
    }
    for (const p of chTl.programs) programEntries.push({ tick: segBase + p.tick, value: p.value });
    for (const b of chTl.bends) bendEntries.push({ tick: segBase + b.tick, value: b.value, range: b.range });
    for (const p of chTl.pans) panEntries.push({ tick: segBase + p.tick, value: p.value });
    for (const v of chTl.vibs) vibEntries.push({ tick: segBase + v.tick, kind: v.kind, value: v.value });
    for (const layer of load.layers) {
      const startOff = chTl.layerStart.has(layer.start) ? chTl.layerStart.get(layer.start) : 0;
      const tl = resolveLayerTimeline(layer.region, base, converting);
      for (const n of tl.notes) events.push({ tick: segBase + startOff + n.tick, order: 1, note: { key: n.key, vel: n.vel, dur: n.dur } });
    }
    segBase += chTl.endTick;
  }
  if (tempos) for (const t of tempos) events.push({ tick: t.tick, order: 0, ev: cmd('Tempo', { value: t.value }) });

  // Instrument: the earliest instr goes in the prefix (before any note); later switches
  // ride the timeline so mid-stream instrument changes carry over. Fall back to the
  // linearly-collected program if the timeline walk found none (rare control-flow shape).
  // The RAW N64 program is carried on the event and resolved at emit time (via emitProgram
  // below), so a chiptune wave can inject its BankSelect in stream order.
  programEntries.sort((a, b) => a.tick - b.tick);
  const firstProgram = programEntries.length ? programEntries[0].value : control.program;
  for (let k = 1; k < programEntries.length; k++) {
    events.push({ tick: programEntries[k].tick, order: 0, program: programEntries[k].value });
  }

  // Pitch bend: `bend` spans +/-1 octave, `bendfine` +/-1 semitone. Set the track's
  // BendRange to the widest range in use and scale each value to it (identity in the
  // common single-range case). No bends -> no BendRange, no PitchBend.
  const trackBendRange = bendEntries.length ? Math.max(...bendEntries.map((b) => b.range)) : 0;
  for (const b of bendEntries) {
    events.push({ tick: b.tick, order: 0, ev: cmd('PitchBend', { value: scaleBend(b.value, b.range, trackBendRange) }) });
  }

  // Pan: N64 pan (u8 0..127) maps 1:1 to 3DS Pan. Pan RIDES the timeline (like volume)
  // so continuous pan sweeps survive — e.g. a stereo-panned bell that sweeps left<->right.
  // The value in effect at tick 0 goes in the prefix (N64 unset pan == CENTER 64; 3DS would
  // otherwise play hard LEFT); the rest ride the timeline. A single static pan at tick 0 is
  // exactly the old prefix-only behaviour (byte-for-byte unchanged).
  panEntries.sort((a, b) => a.tick - b.tick);
  let prefixPan = 64;
  let panStart = 0;
  if (panEntries.length && panEntries[0].tick === 0) { prefixPan = panEntries[0].value; panStart = 1; }
  for (let k = panStart; k < panEntries.length; k++) {
    events.push({ tick: panEntries[k].tick, order: 0, ev: cmd('Pan', { value: panEntries[k].value & 0x7f }) });
  }

  // Vibrato: map each N64 vibrato control to its 3DS Mod* counterpart on the timeline
  // (see the VIB_* constants — approximate, no oracle). A channel that sets a depth but
  // never a rate still needs a nonzero ModSpeed to actually wobble, so supply a default.
  const hasVibrato = vibEntries.length > 0;
  const hasVibFreq = vibEntries.some((v) => v.kind === 'freq');
  for (const v of vibEntries) {
    if (v.kind === 'depth') events.push({ tick: v.tick, order: 0, ev: cmd('ModDepth', { value: clamp7(v.value * VIB_DEPTH_SCALE) }) });
    else if (v.kind === 'freq') events.push({ tick: v.tick, order: 0, ev: cmd('ModSpeed', { value: clamp7(v.value * VIB_FREQ_SCALE) }) });
    else if (v.kind === 'delay') events.push({ tick: v.tick, order: 0, ev: cmd('ModDelay', { value: v.value }) });
    else if (v.kind === 'reset') events.push({ tick: v.tick, order: 0, ev: cmd('ModDepth', { value: 0 }) });
  }

  // Emit a ProgramChange for a RAW N64 program, prefixing a BankSelect whenever the bank
  // index it needs (from the router) differs from the one currently selected. Tracks start
  // on their main bank (index 0) and never BankSelect it explicitly, so a track that never
  // leaves the main bank emits no BankSelect at all (byte-for-byte unchanged from before).
  let currentBank = DEFAULT_BANK;
  const emitProgram = (rawProgram) => {
    const { bank, program } = routeProgram(rawProgram);
    if (bank !== currentBank) { push(cmd('BankSelect', { value: bank })); currentBank = bank; }
    push(cmd('ProgramChange', { value: program & 0x7fffffff }));
  };

  // --- Prefix: notes stack (NoteWait 0), the initial instrument, an explicit Pan, the
  // BendRange, and (once) the vibrato mode + a default rate when the channel gives none. ---
  push(cmd('NoteWait', { value: 0 }));
  if (firstProgram != null) emitProgram(firstProgram);
  push(cmd('Pan', { value: prefixPan }));
  if (trackBendRange) push(cmd('BendRange', { value: trackBendRange }));
  if (hasVibrato) {
    push(cmd('ModType', { value: MOD_TYPE_PITCH }));
    if (!hasVibFreq) push(cmd('ModSpeed', { value: VIB_DEFAULT_SPEED }));
  }

  // Loop only a track that actually has notes (a note-less conductor track just Fins).
  const looped = loop != null && events.some((e) => e.note);
  if (looped) {
    // Mark the loop-start tick with a sentinel (order -1 = before any real event there),
    // so the loop label lands exactly at loop.start — the intro before it plays once.
    events.push({ tick: loop.start, order: -1, loopMark: true });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  // Emit: Wait to advance to each event's tick, then the control/note(s) at that tick.
  // A drum note whose kit has no surviving 3DS slot maps to null and is DROPPED (the
  // Wait still advances the clock, so its slot becomes silence).
  let clock = 0;
  for (const e of events) {
    if (e.tick > clock) { push(cmd('Wait', { value: scaleTicks(e.tick - clock) })); clock = e.tick; }
    if (e.loopMark) { push({ type: 'Label', name: loopLabel }); continue; }
    if (e.program !== undefined) { emitProgram(e.program); continue; }
    if (!e.note) { push(e.ev); continue; }
    const key = mapKey(e.note.key);
    // Note duration is floored at 1 tick. A source note with delay 0 (immediately
    // overtaken on N64) yields dur 0, which on 3DS means "no gate" -> the note never
    // releases and rings forever. Real OoT3D .bcseq files never use a 0-tick note (their
    // floor is 1), so clamp to 1 to keep the blip audible-length without lingering.
    if (key != null) push({ type: 'Note', key: clampKey(key), velocity: e.note.vel & 0x7f, duration: Math.max(1, scaleTicks(e.note.dur)) });
  }

  // Advance the clock to the master period so this track ends in sync with the others.
  // - Looping: pad to the loop length before the Jump, so every track loops at the same
  //   period (a track's notes may end earlier, e.g. a trailing rest before the backward jump).
  // - Not looping: pad to the sequence's total duration (`masterEnd`). On 3DS the whole
  //   sequence stops when the SHORTEST track hits Fin, so an un-padded short track would cut
  //   the longer tracks' tails off early — the fanfare bug. N64 keeps every channel alive
  //   until the seq track's `end`; padding to masterEnd reproduces that. Only extends, never
  //   shortens (a track already longer than masterEnd keeps its length).
  if (looped) {
    if (loop.len > clock) push(cmd('Wait', { value: scaleTicks(loop.len - clock) }));
  } else if (masterEnd > clock) {
    push(cmd('Wait', { value: scaleTicks(masterEnd - clock) }));
  }
  return looped;
}

/**
 * Walk a channel script to recover its own timeline: the tick at which each layer is
 * loaded (`ldlayer`/`rldlayer` — keyed by target offset) and the total length of the
 * channel run (its clock when it hits `end`). Channel delays are `delay`/`delay1`/
 * `cdelay`; control flow (loops/calls/jumps, branches treated as not-taken) is followed
 * exactly like the layer resolver. This is what places a channel's layers on the shared
 * timeline and sizes each re-pointed load. Timed `vol` changes are collected too, so a
 * volume ramp (`vol; cdelay; vol; …`) reaches the IR as time-accurate Volume commands.
 * @param {import('./reader.js').RegionModel} region
 * @returns {{endTick:number, layerStart:Map<number,number>,
 *   vols:{tick:number,value:number}[], programs:{tick:number,value:number}[],
 *   bends:{tick:number,value:number,range:number}[], pans:{tick:number,value:number}[],
 *   vibs:{tick:number,kind:string,value:number}[]}}
 */
function resolveChannelTimeline(region) {
  const cmds = region.cmds;
  const layerStart = new Map();
  const vols = [];
  const programs = [];
  const bends = [];
  const pans = [];
  const vibs = [];
  let pc = region.start;
  let clock = 0;
  const callStack = [];
  const loopStack = [];
  let budget = STEP_BUDGET;

  while (pc != null && cmds.has(pc) && budget-- > 0) {
    const c = cmds.get(pc);
    let next = pc + c.size;
    switch (c.name) {
      case 'delay1': clock += 1; break;
      case 'delay': clock += c.args[0]; break;
      case 'cdelay': clock += c.packed; break; // low nibble packed into the opcode
      case 'vol': vols.push({ tick: clock, value: c.args[0] }); break;
      case 'pan': pans.push({ tick: clock, value: c.args[0] }); break;
      case 'instr': programs.push({ tick: clock, value: c.args[0] }); break;
      case 'bend': bends.push({ tick: clock, value: c.args[0], range: BEND_RANGE_OCTAVE }); break;
      case 'bendfine': bends.push({ tick: clock, value: c.args[0], range: BEND_RANGE_SEMITONE }); break;
      // Vibrato: an LFO on pitch. N64 sets its depth/rate/delay separately (and the
      // instrument's soundfont may add more) -> 3DS Mod* family. See emitTrack for the
      // (oracle-free, approximate) value mapping.
      case 'vibdepth': vibs.push({ tick: clock, kind: 'depth', value: c.args[0] }); break;
      case 'vibfreq': vibs.push({ tick: clock, kind: 'freq', value: c.args[0] }); break;
      case 'vibdelay': vibs.push({ tick: clock, kind: 'delay', value: c.args[0] }); break;
      case 'vibreset': vibs.push({ tick: clock, kind: 'reset', value: 0 }); break;
      case 'ldlayer': case 'rldlayer':
        if (c.target != null && !layerStart.has(c.target)) layerStart.set(c.target, clock);
        break;
      case 'loop': loopStack.push({ backTo: pc + c.size, count: c.args[0] || 256 }); break;
      case 'loopend': {
        const top = loopStack[loopStack.length - 1];
        if (top && --top.count > 0) next = top.backTo;
        else if (top) loopStack.pop();
        break;
      }
      case 'break': if (loopStack.length) loopStack.pop(); break;
      case 'call': if (c.target != null) { callStack.push(pc + c.size); next = c.target; } break;
      case 'jump': case 'rjump': if (c.target != null) next = c.target; break;
      case 'end': next = callStack.length ? callStack.pop() : null; break;
      // branches: not taken; everything else: no timeline effect.
      default: break;
    }
    pc = next;
  }
  return { endTick: clock, layerStart, vols, programs, bends, pans, vibs };
}

/**
 * Walk the sequence/player section for its timed `tempo` changes over ONE iteration and
 * for the LOOP shape. The seq loops via a backward `jump`; the walk stops there. It
 * reports whether the seq loops at all (`hasLoop`), the tick of the jump's TARGET
 * (`loopStartTick` — everything before it is a one-shot intro), and the final clock
 * (`loopLen`, the master period every track loops at). A seq that ends with `end`
 * instead of a backward jump does not loop. Delays/loops/calls are followed; branches
 * are treated as not-taken.
 * @param {import('./reader.js').RegionModel} region
 * @returns {{tempos:{tick:number,value:number}[], loopLen:number, loopStartTick:number, hasLoop:boolean}}
 */
function resolveSeqTimeline(region) {
  const cmds = region.cmds;
  const tempos = [];
  const tickAt = new Map(); // pc -> clock, to resolve the backward jump's target tick
  let loopStartTick = 0;
  let hasLoop = false;
  let pc = region.start;
  let clock = 0;
  const callStack = [];
  const loopStack = [];
  let budget = STEP_BUDGET;

  while (pc != null && cmds.has(pc) && budget-- > 0) {
    tickAt.set(pc, clock);
    const c = cmds.get(pc);
    let next = pc + c.size;
    switch (c.name) {
      case 'delay1': clock += 1; break;
      case 'delay': clock += c.args[0]; break;
      case 'tempo': tempos.push({ tick: clock, value: c.args[0] }); break;
      case 'loop': loopStack.push({ backTo: pc + c.size, count: c.args[0] || 256 }); break;
      case 'loopend': {
        const top = loopStack[loopStack.length - 1];
        if (top && --top.count > 0) next = top.backTo;
        else if (top) loopStack.pop();
        break;
      }
      case 'break': if (loopStack.length) loopStack.pop(); break;
      case 'call': if (c.target != null) { callStack.push(pc + c.size); next = c.target; } break;
      // A backward jump is the loop point: it targets the loop start; stop after one
      // pass. Forward jumps are followed. `end` without a pending call is a one-shot.
      case 'jump': case 'rjump':
        if (c.target != null && c.target > pc) { next = c.target; }
        else { hasLoop = true; loopStartTick = tickAt.has(c.target) ? tickAt.get(c.target) : 0; next = null; }
        break;
      case 'end': next = callStack.length ? callStack.pop() : null; break;
      default: break;
    }
    pc = next;
  }
  return { tempos, loopLen: clock, loopStartTick, hasLoop };
}

/**
 * Interpret a single note layer into a flat list of timed notes (absolute ticks in
 * source units). Loops are unrolled by their counts; jumps/calls are followed; a
 * step budget guards against unbounded self-loops.
 * @param {import('./reader.js').RegionModel} region
 * @param {number} baseTranspose seq + channel transpose applied to every note
 * @param {boolean} [rawKeys] if true, emit the raw note key (pitch+A0) with NO
 *   transpose — for drum channels, whose keys index a sample table (see emitTrack)
 * @returns {{notes:{tick:number,key:number,vel:number,dur:number}[], endTick:number}}
 */
function resolveLayerTimeline(region, baseTranspose, rawKeys) {
  const cmds = region.cmds;
  const notes = [];
  let pc = region.start;
  let clock = 0;
  let transpose = 0;
  let lastDelay = 48;
  let lastGate = 0;
  let shortVel = 100;
  let shortDelay = 48;
  let shortGate = 0;
  const callStack = [];
  const loopStack = [];
  let budget = STEP_BUDGET;

  while (pc != null && cmds.has(pc) && budget-- > 0) {
    const c = cmds.get(pc);
    let next = pc + c.size;

    if (c.note) {
      const key = rawKeys ? c.note.pitch + MIDI_A0 : c.note.pitch + MIDI_A0 + baseTranspose + transpose;
      let vel;
      let delay;
      let gate;
      switch (c.name) {
        case 'notedvg': vel = c.note.velocity; delay = c.note.delay; gate = c.note.gate; lastDelay = delay; lastGate = gate; break;
        case 'notedv': vel = c.note.velocity; delay = c.note.delay; gate = 0; lastDelay = delay; lastGate = 0; break;
        case 'notevg': vel = c.note.velocity; delay = lastDelay; gate = c.note.gate; lastGate = gate; break;
        case 'shortdvg': vel = shortVel; delay = c.note.delay; gate = shortGate; lastDelay = delay; break;
        case 'shortdv': vel = shortVel; delay = shortDelay; gate = shortGate; lastDelay = delay; break;
        default: vel = shortVel; delay = lastDelay; gate = shortGate; break; // shortvg
      }
      // N64 gate time shortens the note within its delay window (higher gate =
      // shorter/more staccato; gate 0 = full length). Matches the OoT audio driver
      // and reproduces the paired real .bcseq note-for-note:
      //   soundingTicks = delay - floor(delay * gate / 256)
      const dur = delay - ((delay * gate) >> 8);
      notes.push({ tick: clock, key, vel, dur });
      clock += delay;
      pc = next;
      continue;
    }

    switch (c.name) {
      case 'delay1': clock += 1; break;
      case 'delay': case 'ldelay': clock += c.args[0]; break;
      case 'shortdelay': shortDelay = c.args[0]; break;
      case 'shortvel': shortVel = c.args[0]; break;
      case 'shortgate': shortGate = c.args[0]; break;
      case 'transpose': transpose = c.args[0]; break;
      case 'loop': loopStack.push({ backTo: pc + c.size, count: c.args[0] || 256 }); break;
      case 'loopend': {
        const top = loopStack[loopStack.length - 1];
        if (top && --top.count > 0) next = top.backTo;
        else if (top) loopStack.pop();
        break;
      }
      case 'break': if (loopStack.length) loopStack.pop(); break;
      case 'call': if (c.target != null) { callStack.push(pc + c.size); next = c.target; } break;
      case 'jump': case 'rjump': if (c.target != null) next = c.target; break;
      case 'end': next = callStack.length ? callStack.pop() : null; break;
      // beqz/bltz/bgez/rbeqz/rbltz: TR unknown at build time -> treat as not taken.
      // Other opcodes (instr, notepan, env, portamento, IO, ...): no timeline effect.
      default: break;
    }
    pc = next;
  }
  return { notes, endTick: clock };
}

/** Channel control state relevant to BCSEQ, collected in linear order. */
function collectChannelControl(region) {
  const out = { program: null, volume: null, pan: null, transpose: 0 };
  for (const c of orderedCmds(region)) {
    if (c.name === 'instr') out.program = c.args[0];
    else if (c.name === 'vol') out.volume = c.args[0];
    else if (c.name === 'pan') out.pan = c.args[0];
    else if (c.name === 'transpose') out.transpose = c.args[0];
  }
  return out;
}

/** Sum of seq-level transpose/rtranspose commands (rtranspose is relative). */
function collectSeqTranspose(region) {
  let t = 0;
  for (const c of orderedCmds(region)) {
    if (c.name === 'transpose') t = c.args[0];
    else if (c.name === 'rtranspose') t += c.args[0];
  }
  return t;
}

/** First value of the named single-arg seq command, or null. */
function firstArg(region, name) {
  for (const c of orderedCmds(region)) if (c.name === name) return c.args[0];
  return null;
}

function cmd(name, args) { return { type: 'Command', name, args }; }
function trackLabel(i) { return 'trk' + i; }
function clampKey(k) { return k < 0 ? 0 : k > 127 ? 127 : k; }
function clamp7(v) { return v < 0 ? 0 : v > 127 ? 127 : v; }
function clampS8(v) { return v < -128 ? -128 : v > 127 ? 127 : v; }

/**
 * Scale an N64 pitch-bend value (linear in semitones over its own `range`) onto the
 * track's chosen BendRange. Identity when the value already uses the track range (the
 * common case); otherwise rescaled so the sounding semitone offset is preserved.
 */
function scaleBend(value, range, trackRange) {
  if (!trackRange || range === trackRange) return clampS8(value);
  return clampS8(Math.round((value * range) / trackRange));
}
