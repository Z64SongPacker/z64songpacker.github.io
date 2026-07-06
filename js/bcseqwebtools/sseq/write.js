// IR -> SSEQ bytes.
//
// Layout produced (all multi-byte fields little-endian):
//   0x00  'SSEQ'                       file magic
//   0x04  u16  byte-order  (0xFEFF)
//   0x06  u16  version     (0x0100)
//   0x08  u32  file size   (back-patched)
//   0x0C  u16  header size (0x0010)
//   0x0E  u16  block count (0x0001)
//   0x10  'DATA'                       block magic
//   0x14  u32  block size  (back-patched)
//   0x18  u32  a32 data offset -> 0x1C (absolute; first command byte)
//   0x1C  ...  command stream
//   ...   pad to 4-byte boundary
//
// Offsets inside OpenTrack/Jump/Call are RELATIVE to the command-stream start
// (the a32 target). Two-pass label resolution: emit the stream recording each
// Label's position and each offset field's position, then patch every offset
// field to its label's recorded position.

import { Writer } from '../bytes/writer.js';
import { writeVLQ } from '../bytes/vlq.js';
import { lookupName, writeParam, WRAP_RANDOM, WRAP_VARIABLE, WRAP_IF } from './commands.js';

const DATA_OFFSET = 0x1c; // header (0x10) + DATA magic+size+a32 (0x0C)

/**
 * Encode an IR Sequence to SSEQ bytes.
 * @param {import('../ir/events.js').Sequence} seq
 * @returns {Uint8Array}
 */
export function write(seq) {
  const stream = new Writer();
  /** @type {Map<string, number>} label name -> relative position */
  const labelPos = new Map();
  /** @type {{at:number, name:string}[]} offset fields awaiting a patch */
  const patches = [];

  for (const ev of seq.events) {
    if (ev.type === 'Label') {
      if (labelPos.has(ev.name)) throw new Error('duplicate label: ' + ev.name);
      labelPos.set(ev.name, stream.length);
      continue;
    }
    emitEvent(stream, ev, patches);
  }

  // Resolve every recorded offset field to its label's relative position.
  for (const p of patches) {
    if (!labelPos.has(p.name)) throw new Error('unresolved label: ' + p.name);
    stream.patch(p.at, labelPos.get(p.name), 3, true /* little-endian */);
  }

  const streamBytes = stream.toBytes();

  // Assemble the file around the command stream.
  const file = new Writer(streamBytes.length + 64);
  file.ascii('SSEQ');
  file.u16le(seq.byteOrder != null ? seq.byteOrder : 0xfeff);
  file.u16le(seq.version != null ? seq.version : 0x0100);
  const fileSizeAt = file.reserve(4);
  file.u16le(seq.headerSize != null ? seq.headerSize : 0x10);
  file.u16le(seq.blockCount != null ? seq.blockCount : 1);

  const blockStart = file.length; // 0x10
  file.ascii('DATA');
  const blockSizeAt = file.reserve(4);
  file.u32le(DATA_OFFSET); // a32 -> 0x1C (matches current position)
  if (file.length !== DATA_OFFSET) {
    throw new Error('internal: data offset drift, got 0x' + file.length.toString(16));
  }
  file.bytes(streamBytes);

  // Pad the block/file to a 4-byte boundary, reproducing the source pad byte.
  const padByte = seq.padByte != null ? seq.padByte : 0x00;
  file.padTo(4, padByte);

  file.patch(blockSizeAt, file.length - blockStart, 4, true);
  file.patch(fileSizeAt, file.length, 4, true);
  return file.toBytes();
}

/**
 * Emit a single non-Label event (Note or Command), honouring wrapper prefixes.
 * @param {Writer} w
 * @param {object} ev
 * @param {{at:number, name:string}[]} patches
 */
function emitEvent(w, ev, patches) {
  const wrapper = ev.wrapper;
  const dropLast = !!wrapper && (wrapper.kind === 'random' || wrapper.kind === 'variable');

  if (wrapper) {
    if (wrapper.kind === 'random') w.u8(WRAP_RANDOM);
    else if (wrapper.kind === 'variable') w.u8(WRAP_VARIABLE);
    else if (wrapper.kind === 'if') w.u8(WRAP_IF);
    else throw new Error('unknown wrapper kind: ' + wrapper.kind);
  }

  // Emit the wrapped command's opcode + parameters (minus the dropped last one).
  if (ev.type === 'Note') {
    if (ev.key < 0 || ev.key > 0x7f) throw new Error('note key out of range: ' + ev.key);
    w.u8(ev.key);
    // params in order: velocity (u8), duration (vl)
    w.u8(ev.velocity & 0xff);
    if (!dropLast) writeVLQ(w, ev.duration);
  } else if (ev.type === 'Command') {
    const def = lookupName(ev.name);
    if (!def) throw new Error('unknown command: ' + ev.name);
    w.u8(def.opcode);
    const n = dropLast ? def.params.length - 1 : def.params.length;
    for (let i = 0; i < n; i++) {
      const p = def.params[i];
      const v = ev.args[p.name];
      if (p.kind === 'offset') {
        if (typeof v !== 'string') {
          throw new Error('offset param "' + p.name + '" of ' + ev.name + ' must be a label name');
        }
        patches.push({ at: w.length, name: v });
        w.reserve(3);
      } else {
        if (typeof v !== 'number') {
          throw new Error('missing/invalid param "' + p.name + '" for ' + ev.name);
        }
        writeParam(w, p.kind, v);
      }
    }
  } else {
    throw new Error('cannot emit event of type: ' + ev.type);
  }

  // Emit the wrapper's supplied trailing data.
  if (wrapper) {
    if (wrapper.kind === 'random') {
      w.s16le(wrapper.min);
      w.s16le(wrapper.max);
    } else if (wrapper.kind === 'variable') {
      w.u8(wrapper.variable);
    }
    // 'if' supplies nothing extra.
  }
}
