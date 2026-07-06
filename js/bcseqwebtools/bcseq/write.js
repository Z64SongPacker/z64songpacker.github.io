// IR -> BCSEQ (3DS/Wii-U CSEQ) bytes.
//
// Container header + block table are LITTLE-endian; the DATA block's command
// stream is BIG-endian (see commands.js). Layout:
//   0x00  'CSEQ'
//   0x04  u16 byteOrder (0xFEFF), u16 headerSize (0x40)
//   0x08  u32 version
//   0x0C  u32 file size            (back-patched)
//   0x10  u32 block count
//   0x14  block table: { u32 id, u32 offset, u32 size } * count  (back-patched)
//   ...   zero-pad to headerSize
//   0x40  DATA block: 'DATA' + u32 size + command stream + zero-pad to 32 bytes
//   ...   other blocks (e.g. LABL) reproduced verbatim
//
// Offsets in OpenTrack/Jump/Call are relative to the command-stream start and
// are resolved from recorded Label positions (two-pass, like the SSEQ writer).

import { Writer } from '../bytes/writer.js';
import { writeVLQ } from '../bytes/vlq.js';
import {
  lookupName, writeParam, WRAP_OPCODE, EXTENDED_PREFIX,
} from './commands.js';

const DATA_BLOCK_ID = 0x5000;

/**
 * @param {import('../ir/events.js').Sequence} seq
 * @returns {Uint8Array}
 */
export function write(seq) {
  const meta = defaultMeta(seq.bcseq);

  // --- Pass 1/2: emit the command stream, resolving labels to offsets. ---
  const stream = new Writer();
  const labelPos = new Map();
  const patches = [];
  for (const ev of seq.events) {
    if (ev.type === 'Label') {
      if (labelPos.has(ev.name)) throw new Error('duplicate label: ' + ev.name);
      labelPos.set(ev.name, stream.length);
      continue;
    }
    emitEvent(stream, ev, patches);
  }
  for (const p of patches) {
    if (!labelPos.has(p.name)) throw new Error('unresolved label: ' + p.name);
    stream.patch(p.at, labelPos.get(p.name), 3, false /* big-endian */);
  }
  const streamBytes = stream.toBytes();

  // --- Assemble the container. ---
  const file = new Writer(streamBytes.length + meta.headerSize + 64);
  file.ascii('CSEQ');
  file.u16le(meta.byteOrder);
  file.u16le(meta.headerSize);
  file.u32le(meta.version);
  const fileSizeAt = file.reserve(4);
  file.u32le(meta.blocks.length);

  // Block table with placeholder offset/size per block.
  const tableAt = [];
  for (const b of meta.blocks) {
    file.u32le(b.id);
    const offAt = file.reserve(4);
    const sizeAt = file.reserve(4);
    tableAt.push({ offAt, sizeAt });
  }
  while (file.length < meta.headerSize) file.u8(0x00);

  // Emit blocks in order; DATA is regenerated, others reproduced verbatim.
  for (let i = 0; i < meta.blocks.length; i++) {
    const b = meta.blocks[i];
    const start = file.length;
    if (b.id === DATA_BLOCK_ID) {
      file.ascii('DATA');
      const dataSizeAt = file.reserve(4);
      file.bytes(streamBytes);
      while ((file.length - start) % meta.alignment !== 0) file.u8(meta.padByte);
      const size = file.length - start;
      file.patch(dataSizeAt, size, 4, true);
      file.patch(tableAt[i].offAt, start, 4, true);
      file.patch(tableAt[i].sizeAt, size, 4, true);
    } else {
      file.bytes(b.verbatim);
      file.patch(tableAt[i].offAt, start, 4, true);
      file.patch(tableAt[i].sizeAt, b.verbatim.length, 4, true);
    }
  }

  file.patch(fileSizeAt, file.length, 4, true);
  return file.toBytes();
}

/** Fill in sensible defaults for an authored (non-round-tripped) sequence. */
function defaultMeta(bcseq) {
  const m = bcseq || {};
  return {
    byteOrder: m.byteOrder != null ? m.byteOrder : 0xfeff,
    headerSize: m.headerSize != null ? m.headerSize : 0x40,
    version: m.version != null ? m.version : 0x01000000,
    alignment: m.alignment != null ? m.alignment : 32,
    padByte: m.padByte != null ? m.padByte : 0x00,
    blocks: m.blocks && m.blocks.length ? m.blocks : [{ id: DATA_BLOCK_ID, verbatim: null }],
  };
}

/**
 * Emit one non-Label event (Note or Command), honouring a wrapper prefix.
 * @param {Writer} w
 * @param {object} ev
 * @param {{at:number, name:string}[]} patches
 */
function emitEvent(w, ev, patches) {
  const wrapper = ev.wrapper;
  if (!wrapper) {
    emitInner(w, ev, false, patches);
    return;
  }
  const dropLast = wrapper.kind === 'random' || wrapper.kind === 'variable';
  w.u8(WRAP_OPCODE[wrapper.kind]);
  emitInner(w, ev, dropLast, patches);
  if (wrapper.kind === 'random' || wrapper.kind === 'timeRandom') {
    w.s16be(wrapper.min);
    w.s16be(wrapper.max);
  } else if (wrapper.kind === 'variable' || wrapper.kind === 'timeVariable') {
    w.u8(wrapper.variable);
  } else if (wrapper.kind === 'time') {
    w.s16be(wrapper.value);
  }
  // 'if' supplies nothing extra.
}

/**
 * Emit the command's opcode + parameters (minus the last one if dropLast).
 * @param {Writer} w
 * @param {object} ev
 * @param {boolean} dropLast
 * @param {{at:number, name:string}[]} patches
 */
function emitInner(w, ev, dropLast, patches) {
  if (ev.type === 'Note') {
    if (ev.key < 0 || ev.key > 0x7f) throw new Error('note key out of range: ' + ev.key);
    w.u8(ev.key);
    w.u8(ev.velocity & 0xff);
    if (!dropLast) writeVLQ(w, ev.duration);
    return;
  }
  if (ev.type !== 'Command') throw new Error('cannot emit event of type: ' + ev.type);

  const def = lookupName(ev.name);
  if (!def) throw new Error('unknown command: ' + ev.name);
  if (def.extended) {
    w.u8(EXTENDED_PREFIX);
    w.u8(def.sub);
  } else {
    w.u8(def.opcode);
  }
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
}
