// N64 Audioseq bytes -> faithful raw section model (no musical interpretation).
//
// Audioseq is big-endian with NO header: execution starts at offset 0 in the SEQ
// section. This reader decodes the three CODE sections (SEQ, CHAN, LAYER) by
// following pointers: the SEQ section's `ldchan` commands point at channel scripts,
// and each channel's `ldlayer` commands point at note-layer scripts. Within a
// section, jumps/calls/branches are followed so a section's full command set is
// recovered (mirrors the decomp disassembler's work-queue, scoped per region).
//
// Output is a raw tree — opcode name, positional args, absolute offset, size, and
// control-flow classification — with layer note events already split out (their
// large/short encoding resolved from the owning channel's short/noshort state).
// Interpretation into the shared IR happens in toIr.js.

import { Reader } from '../bytes/reader.js';
import { SECTION, lookup, readVar } from './commands.js';

/**
 * @typedef {object} N64Cmd
 * @property {number} off absolute byte offset of this command
 * @property {number} size command length in bytes
 * @property {string} section owning section (SEQ/CHAN/LAYER)
 * @property {string} name mnemonic
 * @property {number[]} args positional argument values
 * @property {string} [ctrl] flow class: end/jump/call/branch/loop/loopend/break
 * @property {number} [packed] value packed into the opcode byte (chan/layer/port)
 * @property {number} [target] resolved absolute offset of a pointer argument
 * @property {string} [targetSection] section the pointer target belongs to
 * @property {{pitch:number, delay?:number, velocity?:number, gate?:number}} [note]
 */

/**
 * Decode one Audioseq sequence into a raw model.
 * @param {Uint8Array} bytes
 * @returns {{
 *   bytes: Uint8Array,
 *   seq: RegionModel,
 *   channels: {num:number, start:number, region:RegionModel,
 *              layers:{num:number, start:number, shortNotes:boolean, region:RegionModel}[]}[]
 * }}
 */
export function read(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('read expects a Uint8Array');

  const seq = decodeRegion(bytes, 0, SECTION.SEQ, false);

  const channels = [];
  const seenChan = new Set();
  for (const ref of seq.subRefs) {
    if (ref.kind !== 'chan' || ref.target == null) continue;
    if (seenChan.has(ref.target)) continue;
    seenChan.add(ref.target);

    const region = decodeRegion(bytes, ref.target, SECTION.CHAN, false);
    const layers = [];
    const seenLayer = new Set();
    for (const lref of region.subRefs) {
      if (lref.kind !== 'layer' || lref.target == null) continue;
      if (seenLayer.has(lref.target)) continue;
      seenLayer.add(lref.target);
      const lregion = decodeRegion(bytes, lref.target, SECTION.LAYER, lref.shortNotes);
      layers.push({ num: lref.num, start: lref.target, shortNotes: lref.shortNotes, region: lregion });
    }
    channels.push({ num: ref.num, start: ref.target, region, layers });
  }

  return { bytes, seq, channels };
}

/**
 * @typedef {object} RegionModel
 * @property {string} section
 * @property {number} start
 * @property {Map<number, N64Cmd>} cmds command by absolute offset
 * @property {Set<number>} targets offsets that are branch/call targets (label sites)
 * @property {{kind:string, num:number, target:number, shortNotes?:boolean}[]} subRefs
 */

/**
 * Decode a single section region: linear from `start`, following intra-section
 * jumps/calls/branches, until every reachable path terminates. Cross-section
 * pointers (ldchan/ldlayer) are recorded in `subRefs` for the caller to recurse.
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {string} section
 * @param {boolean} shortNotesInit initial short-note state (channels only)
 * @returns {RegionModel}
 */
function decodeRegion(bytes, start, section, shortNotesInit) {
  const r = new Reader(bytes);
  const end = bytes.length;
  /** @type {Map<number, N64Cmd>} */
  const cmds = new Map();
  const targets = new Set();
  const subRefs = [];
  let shortNotes = !!shortNotesInit;

  const queue = [start];
  while (queue.length) {
    let pos = queue.pop();
    if (pos == null || pos < 0 || pos >= end) continue;

    // Decode a straight-line run from `pos`, stopping at a terminal or an
    // unconditional branch (or where a previously-decoded command begins).
    while (pos < end && !cmds.has(pos)) {
      r.seek(pos);
      const cmd = decodeOne(r, section, shortNotes);
      cmd.off = pos;
      cmd.size = r.pos - pos;
      cmds.set(pos, cmd);

      // Track large/short note state along the linear path (channel scope).
      if (section === SECTION.CHAN) {
        if (cmd.name === 'short') shortNotes = true;
        else if (cmd.name === 'noshort') shortNotes = false;
      }

      // Record cross-section references for the caller to recurse into.
      if (cmd.name === 'ldchan' || cmd.name === 'rldchan') {
        subRefs.push({ kind: 'chan', num: cmd.packed, target: cmd.target });
      } else if (cmd.name === 'ldlayer' || cmd.name === 'rldlayer') {
        subRefs.push({ kind: 'layer', num: cmd.packed, target: cmd.target, shortNotes });
      }

      // Intra-section control flow.
      if (cmd.ctrl === 'end') break;
      if (cmd.target != null && cmd.targetSection === section) {
        targets.add(cmd.target);
        queue.push(cmd.target);
      }
      if (cmd.ctrl === 'jump') break; // unconditional: no fall-through

      pos = r.pos;
    }
  }

  return { section, start, cmds, targets, subRefs };
}

/**
 * Decode a single command at the cursor. Layer note opcodes (0x00-0xBF) are
 * resolved here against `shortNotes`; everything else comes from the table.
 * @param {Reader} r
 * @param {string} section
 * @param {boolean} shortNotes
 * @returns {N64Cmd}
 */
function decodeOne(r, section, shortNotes) {
  const byte = r.u8();

  // Layer note events: status byte is (range | pitch), pitch = low 6 bits.
  if (section === SECTION.LAYER && byte < 0xc0) {
    return decodeNote(r, byte, shortNotes);
  }

  const hit = lookup(section, byte);
  if (!hit) {
    throw new Error(
      'unknown opcode 0x' + byte.toString(16) + ' in ' + section +
      ' section at 0x' + (r.pos - 1).toString(16)
    );
  }
  const { def, packedValue } = hit;

  /** @type {N64Cmd} */
  const cmd = { section, name: def.name, args: [], ctrl: def.ctrl, packed: packedValue };

  for (let i = 0; i < def.args.length; i++) {
    const kind = def.args[i];
    if (kind === 'portTime') {
      // Layer portamento time: u8 when mode (args[0]) has bit 7 set, else var.
      cmd.args.push((cmd.args[0] & 0x80) ? r.u8() : readVar(r));
      continue;
    }
    const { value, target } = readArg(r, kind);
    cmd.args.push(value);
    if (target != null) {
      cmd.target = target;
      cmd.targetSection = def.to === 'SELF' ? section : def.to;
    }
  }
  return cmd;
}

/**
 * Read one argument, returning its value and (for pointers) a resolved target.
 * @param {Reader} r
 * @param {string} kind
 * @returns {{value:number, target?:number}}
 */
function readArg(r, kind) {
  switch (kind) {
    case 'u8': return { value: r.u8() };
    case 's8': return { value: r.s8() };
    case 'u16': return { value: r.u16be() };
    case 's16': return { value: r.s16be() };
    case 'var': return { value: readVar(r) };
    case 'pAbs': { const v = r.u16be(); return { value: v, target: v }; }
    // Relative pointers are measured from just after the offset bytes.
    case 'pRel8': { const off = r.s8(); return { value: off, target: r.pos + off }; }
    case 'pRel16': { const off = r.s16be(); return { value: off, target: r.pos + off }; }
    default: throw new Error('unknown arg kind: ' + kind);
  }
}

/**
 * Decode a layer note event from its status byte + owning short/large state.
 * Large: notedvg/notedv/notevg; short: shortdvg/shortdv/shortvg. Pitch is the low
 * 6 bits; the top two bits select the encoding (0x00/0x40/0x80).
 * @param {Reader} r
 * @param {number} byte
 * @param {boolean} shortNotes
 * @returns {N64Cmd}
 */
function decodeNote(r, byte, shortNotes) {
  const pitch = byte & 0x3f;
  const range = byte & 0xc0;
  const note = { pitch };
  let name;
  if (!shortNotes) {
    if (range === 0x00) { name = 'notedvg'; note.delay = readVar(r); note.velocity = r.u8(); note.gate = r.u8(); }
    else if (range === 0x40) { name = 'notedv'; note.delay = readVar(r); note.velocity = r.u8(); note.gate = 0; }
    else { name = 'notevg'; note.velocity = r.u8(); note.gate = r.u8(); } // delay reused from previous note
  } else {
    if (range === 0x00) { name = 'shortdvg'; note.delay = readVar(r); }
    else if (range === 0x40) { name = 'shortdv'; }
    else { name = 'shortvg'; }
  }
  return { section: SECTION.LAYER, name, args: [], note };
}

/**
 * Convenience: a region's commands in ascending offset order.
 * @param {RegionModel} region
 * @returns {N64Cmd[]}
 */
export function orderedCmds(region) {
  return [...region.cmds.values()].sort((a, b) => a.off - b.off);
}
