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
//   - Channel control maps: instrument -> ProgramChange, vol -> Volume, pan -> Pan;
//     transposition (seq + channel + layer) is baked into note keys.
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
// Every track therefore emits an explicit Pan (its value, or 64 when unset).
//
// Looping is intrinsic, taken from the .seq (NOT a user option): if the seq section
// ends in a backward `jump`, each track loops with a `Jump` back to a label at the loop
// point (the intro before it plays once); all tracks are padded to the master period so
// they stay in sync. A seq that ends with `end` plays once. (See resolveSeqTimeline.)
//
// Timebase: N64 delays are tatums (48/beat). If opts.bcseqTimebase differs from
// opts.n64Timebase (both default 48), every delay/duration is scaled and a Timebase
// command is emitted on track 0.

import { Sequence } from '../ir/events.js';
import { orderedCmds } from './reader.js';
import { makeDrumKeyRemap, drumKitForBank } from './drums.js';
import { N64_DRUM_PROGRAM } from './banks.js';

const MIDI_A0 = 21; // N64 pitch index 0 == PITCH_A0 == MIDI note 21.
const MAX_TRACKS = 16; // BCSEQ hard cap (u16 track mask, track 0 implicit).
const STEP_BUDGET = 200000; // guard against unbounded layer self-loops.

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

  // Group channel loads by channel number (first-seen order), one track each.
  const groups = groupByChannelNumber(model.channels);

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
    const looped = emitTrack(push, groups[i], seqTranspose, remapProgram, remapDrumKey, scaleTicks, i === 0 ? seqTempos : null, loop, loopLabel);
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
 * Emit one track: a channel-control prefix followed by one merged, timeline-ordered
 * stream of the channel's notes, its volume changes, and (for track 0) the sequence's
 * tempo changes — all across every load of this channel number.
 * @param {((key:number)=>number)|null} remapDrumKey drum-note key remap, or null
 * @param {number[]} tempos conductor tempo events `{tick,value}` (track 0 only; else null)
 * @param {{start:number,len:number}|null} loop loop-start tick + master period, or null
 * @param {string|null} loopLabel name for this track's loop label (when looping)
 * @returns {boolean} whether this track looped (a loop label + Jump are warranted)
 */
function emitTrack(push, group, seqTranspose, remapProgram, remapDrumKey, scaleTicks, tempos, loop, loopLabel) {
  const control = collectChannelControl(group.loads[0].region);
  // Drum channels (N64 program 0x7F) index a reordered 3DS drum kit. When a kit is
  // active, remap the RAW note key (percussion keys index a sample table, so transpose
  // does not apply — build note keys without it). Detection uses the RAW program.
  const converting = control.program === N64_DRUM_PROGRAM && remapDrumKey != null;
  const mapKey = converting ? remapDrumKey : (k) => k;

  push(cmd('NoteWait', { value: 0 })); // notes stack; explicit Wait advances time
  if (control.program != null) push(cmd('ProgramChange', { value: remapProgram(control.program) & 0x7fffffff }));
  // N64 defaults an unset channel pan to CENTER (64); 3DS defaults to hard LEFT (0), so
  // ALWAYS emit an explicit Pan (else channels without a `pan` command play only left).
  push(cmd('Pan', { value: control.pan != null ? control.pan : 64 }));

  // Build one timed event list, merging across the channel's loads. Re-pointed loads
  // (intro then main) are laid end to end via segBase. Each load's length and its
  // layers' start offsets come from the CHANNEL script's own timeline (its delays /
  // ldlayer positions), not just the layer note lengths — a load may be a layer-less
  // intro (e.g. `instr; delay 288; end`) whose 288-tick delay must still advance the
  // clock, or it may load a layer partway through the channel. Volume commands ride
  // the same channel timeline (a vol ramp is `vol; cdelay; vol; cdelay; …`) so they
  // stay time-accurate. `order` puts control changes before notes at the same tick.
  const events = []; // {tick, order, ev?} | {tick, order, note:{key,vel,dur}}
  let segBase = 0;
  for (const load of group.loads) {
    const base = seqTranspose + (collectChannelControl(load.region).transpose || 0);
    const chTl = resolveChannelTimeline(load.region);
    for (const v of chTl.vols) {
      events.push({ tick: segBase + v.tick, order: 0, ev: cmd('Volume', { value: v.value & 0xff }) });
    }
    for (const layer of load.layers) {
      const startOff = chTl.layerStart.has(layer.start) ? chTl.layerStart.get(layer.start) : 0;
      const tl = resolveLayerTimeline(layer.region, base, converting);
      for (const n of tl.notes) events.push({ tick: segBase + startOff + n.tick, order: 1, note: { key: n.key, vel: n.vel, dur: n.dur } });
    }
    segBase += chTl.endTick;
  }
  if (tempos) for (const t of tempos) events.push({ tick: t.tick, order: 0, ev: cmd('Tempo', { value: t.value }) });

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
    if (!e.note) { push(e.ev); continue; }
    const key = mapKey(e.note.key);
    if (key != null) push({ type: 'Note', key: clampKey(key), velocity: e.note.vel & 0x7f, duration: scaleTicks(e.note.dur) });
  }

  // When looping, advance the clock to the master loop length so this track's Jump loops
  // at the same period as every other track (its notes may end earlier, e.g. a trailing
  // rest before the seq's backward jump). No-op when not looping.
  if (looped && loop.len > clock) push(cmd('Wait', { value: scaleTicks(loop.len - clock) }));
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
 * @returns {{endTick:number, layerStart:Map<number,number>, vols:{tick:number,value:number}[]}}
 */
function resolveChannelTimeline(region) {
  const cmds = region.cmds;
  const layerStart = new Map();
  const vols = [];
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
  return { endTick: clock, layerStart, vols };
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
