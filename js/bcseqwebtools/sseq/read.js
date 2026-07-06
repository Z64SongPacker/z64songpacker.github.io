// SSEQ bytes -> IR.
//
// Parses the file header + DATA block, then linearly decodes the command stream
// from the a32 data offset. Offset parameters (OpenTrack/Jump/Call) are relative
// to the stream start; each referenced position becomes a symbolic Label so the
// writer can reproduce identical offsets. This is the round-trip oracle for the
// whole Nintendo half: read(bytes) then write(ir) must reproduce bytes.

import { Reader } from '../bytes/reader.js';
import { Sequence } from '../ir/events.js';
import { lookupOpcode, lookupName, readParam, WRAP_RANDOM, WRAP_VARIABLE, WRAP_IF } from './commands.js';

/**
 * @param {Uint8Array} bytes
 * @returns {import('../ir/events.js').Sequence}
 */
export function read(bytes) {
  const r = new Reader(bytes);
  const magic = r.ascii(4);
  if (magic !== 'SSEQ') throw new Error('not an SSEQ file (magic="' + magic + '")');

  const seq = new Sequence();
  seq.byteOrder = r.u16le();
  seq.version = r.u16le();
  const fileSize = r.u32le();
  seq.headerSize = r.u16le();
  seq.blockCount = r.u16le();

  // The single DATA block starts right after the file header.
  r.seek(seq.headerSize);
  const blockStart = r.pos;
  const blockMagic = r.ascii(4);
  if (blockMagic !== 'DATA') throw new Error('expected DATA block (got "' + blockMagic + '")');
  const blockSize = r.u32le();
  const dataOffset = r.u32le(); // a32, absolute file offset of first command

  // End of the block's meaningful+padding region.
  const blockEnd = Math.min(blockStart + blockSize, bytes.length);
  // Sanity: fileSize should agree with the block, but don't hard-fail on it.
  void fileSize;

  r.seek(dataOffset);
  const streamStart = dataOffset; // offsets in commands are relative to here

  /** @type {{rel:number, event:object}[]} decoded commands with their positions */
  const decoded = [];
  /** @type {Set<number>} relative positions referenced by offset params */
  const targets = new Set();
  /** @type {{event:object, param:string}[]} offset params to resolve to labels */
  const offsetRefs = [];

  let padLength = 0;
  let padByte = 0x00;

  while (r.pos < blockEnd) {
    const rem = blockEnd - r.pos;
    // Trailing 4-byte-alignment padding (writer default 0x00). Only ever 1-3
    // bytes; a real command run ends before it.
    if (rem <= 3 && isPadRun(bytes, r.pos, blockEnd)) {
      padLength = rem;
      padByte = bytes[r.pos];
      break;
    }

    const rel = r.pos - streamStart;
    const event = decodeCommand(r);
    decoded.push({ rel, event });

    // Collect any offset parameters for later label resolution.
    if (event.type === 'Command') {
      const def = lookupName(event.name);
      for (const p of def.params) {
        if (p.kind === 'offset' && typeof event.args[p.name] === 'number') {
          targets.add(event.args[p.name]);
          offsetRefs.push({ event, param: p.name });
        }
      }
    }
  }

  // Map each referenced relative position to the command that starts there.
  /** @type {Map<number, string>} rel position -> label name */
  const labelFor = new Map();
  const byRel = new Map();
  for (const d of decoded) byRel.set(d.rel, d);
  for (const t of targets) {
    // A target that isn't a command boundary means our linear decode diverged
    // from the file's structure — surface it rather than emit a bad label.
    if (!byRel.has(t)) {
      throw new Error('jump/call target 0x' + t.toString(16) + ' is not a command boundary');
    }
    labelFor.set(t, 'L_' + t.toString(16).padStart(4, '0'));
  }

  // Replace numeric offsets with their label names.
  for (const ref of offsetRefs) {
    const rel = ref.event.args[ref.param];
    ref.event.args[ref.param] = labelFor.get(rel);
  }

  // Build the final flat event list, inserting Label markers before targets.
  for (const d of decoded) {
    if (labelFor.has(d.rel)) {
      seq.events.push({ type: 'Label', name: labelFor.get(d.rel) });
    }
    seq.events.push(d.event);
  }

  seq.padByte = padByte;
  seq.padLength = padLength;
  return seq;
}

/**
 * Decode a single command (with optional wrapper prefix) at the cursor.
 * @param {Reader} r
 * @returns {object} an IR event
 */
function decodeCommand(r) {
  const first = r.u8();

  let wrapper = null;
  let status = first;
  if (first === WRAP_RANDOM || first === WRAP_VARIABLE || first === WRAP_IF) {
    status = r.u8();
    wrapper = { kind: first === WRAP_RANDOM ? 'random' : first === WRAP_VARIABLE ? 'variable' : 'if' };
  }

  const dropLast = wrapper && (wrapper.kind === 'random' || wrapper.kind === 'variable');
  let event;

  if (status < 0x80) {
    // Note: key = status byte, velocity u8, duration VL (dropped if random/var).
    const key = status;
    const velocity = r.u8();
    const duration = dropLast ? 0 : readParam(r, 'vl');
    event = { type: 'Note', key, velocity, duration };
  } else {
    const def = lookupOpcode(status);
    if (!def) throw new Error('unknown opcode 0x' + status.toString(16) + ' at ' + (r.pos - 1));
    const args = {};
    const n = dropLast ? def.params.length - 1 : def.params.length;
    for (let i = 0; i < n; i++) {
      const p = def.params[i];
      args[p.name] = readParam(r, p.kind);
    }
    event = { type: 'Command', name: def.name, args };
  }

  if (wrapper) {
    if (wrapper.kind === 'random') {
      wrapper.min = r.s16le();
      wrapper.max = r.s16le();
    } else if (wrapper.kind === 'variable') {
      wrapper.variable = r.u8();
    }
    event.wrapper = wrapper;
  }
  return event;
}

/**
 * True if bytes[start..end) are all the same value (a plausible pad run).
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} end
 */
function isPadRun(bytes, start, end) {
  if (start >= end) return true;
  const v = bytes[start];
  // Only treat 0x00 as auto-detected padding; 0xFF tails are decoded as Fin and
  // still round-trip byte-exactly.
  if (v !== 0x00) return false;
  for (let i = start + 1; i < end; i++) if (bytes[i] !== v) return false;
  return true;
}
