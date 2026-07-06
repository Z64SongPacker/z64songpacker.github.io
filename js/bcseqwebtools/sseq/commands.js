// SSEQ command table — the single source of truth for opcode <-> parameter
// layout, shared by both the writer (IR -> bytes) and reader (bytes -> IR).
//
// Wire bytes are the canonical NDS SSEQ opcodes (as documented in
// docs/sseq-spec.md). Multi-byte parameters are LITTLE-ENDIAN. Notes
// (0x00-0x7F) are handled specially by read.js/write.js, not via this table.
//
// Parameter kinds:
//   u8   unsigned byte
//   s8   signed byte
//   bool unsigned byte used as 0/1 (kept distinct for readability)
//   u16  unsigned 16-bit LE
//   s16  signed 16-bit LE
//   u24  unsigned 24-bit LE
//   vl   variable-length quantity (see bytes/vlq.js)
//   offset  24-bit LE on the wire, but carried in the IR as a symbolic label
//           name; resolved to a relative byte position at encode time.

import { readVLQ, writeVLQ } from '../bytes/vlq.js';

// Wrapper prefix opcodes (Random / Variable / If).
export const WRAP_RANDOM = 0xa0;
export const WRAP_VARIABLE = 0xa1;
export const WRAP_IF = 0xa2;

/**
 * Read one parameter of the given kind from a Reader.
 * @param {import('../bytes/reader.js').Reader} r
 * @param {string} kind
 * @returns {number}
 */
export function readParam(r, kind) {
  switch (kind) {
    case 'u8': return r.u8();
    case 's8': return r.s8();
    case 'bool': return r.u8();
    case 'u16': return r.u16le();
    case 's16': return r.s16le();
    case 'u24': return r.u24le();
    case 'offset': return r.u24le();
    case 'vl': return readVLQ(r);
    default: throw new Error('unknown param kind: ' + kind);
  }
}

/**
 * Write one parameter of the given kind to a Writer.
 * @param {import('../bytes/writer.js').Writer} w
 * @param {string} kind
 * @param {number} v
 */
export function writeParam(w, kind, v) {
  switch (kind) {
    case 'u8': w.u8(v); break;
    case 's8': w.s8(v); break;
    case 'bool': w.u8(v); break;
    case 'u16': w.u16le(v); break;
    case 's16': w.s16le(v); break;
    case 'u24': w.u24le(v); break;
    case 'offset': w.u24le(v); break;
    case 'vl': writeVLQ(w, v); break;
    default: throw new Error('unknown param kind: ' + kind);
  }
}

// Definition list. Order of params is significant: the Random/Variable wrappers
// drop the LAST parameter (the wrapper supplies it dynamically).
const DEFS = [
  ['Wait', 0x80, [['ticks', 'vl']]],
  ['ProgramChange', 0x81, [['program', 'vl']]],

  ['OpenTrack', 0x93, [['track', 'u8'], ['offset', 'offset']]],
  ['Jump', 0x94, [['offset', 'offset']]],
  ['Call', 0x95, [['offset', 'offset']]],

  // Variable / compare operations: var index (u8) + value (s16).
  ['SetVar', 0xb0, [['var', 'u8'], ['value', 's16']]],
  ['AddVar', 0xb1, [['var', 'u8'], ['value', 's16']]],
  ['SubVar', 0xb2, [['var', 'u8'], ['value', 's16']]],
  ['MulVar', 0xb3, [['var', 'u8'], ['value', 's16']]],
  ['DivVar', 0xb4, [['var', 'u8'], ['value', 's16']]],
  ['ShiftVar', 0xb5, [['var', 'u8'], ['value', 's16']]],
  ['RandVar', 0xb6, [['var', 'u8'], ['value', 's16']]],
  ['CmpEq', 0xb8, [['var', 'u8'], ['value', 's16']]],
  ['CmpGe', 0xb9, [['var', 'u8'], ['value', 's16']]],
  ['CmpGt', 0xba, [['var', 'u8'], ['value', 's16']]],
  ['CmpLe', 0xbb, [['var', 'u8'], ['value', 's16']]],
  ['CmpLt', 0xbc, [['var', 'u8'], ['value', 's16']]],
  ['CmpNe', 0xbd, [['var', 'u8'], ['value', 's16']]],

  ['Pan', 0xc0, [['value', 'u8']]],
  ['Volume', 0xc1, [['value', 'u8']]],
  ['MainVolume', 0xc2, [['value', 'u8']]],
  ['Transpose', 0xc3, [['value', 's8']]],
  ['PitchBend', 0xc4, [['value', 's8']]],
  ['PitchBendRange', 0xc5, [['value', 'u8']]],
  ['Priority', 0xc6, [['value', 'u8']]],
  ['NoteWait', 0xc7, [['value', 'bool']]],
  ['Tie', 0xc8, [['value', 'bool']]],
  ['Portamento', 0xc9, [['value', 'u8']]],
  ['ModDepth', 0xca, [['value', 'u8']]],
  ['ModSpeed', 0xcb, [['value', 'u8']]],
  ['ModType', 0xcc, [['value', 'u8']]],
  ['ModRange', 0xcd, [['value', 'u8']]],
  ['PortamentoSwitch', 0xce, [['value', 'bool']]],
  ['PortamentoTime', 0xcf, [['value', 'u8']]],
  ['Attack', 0xd0, [['value', 'u8']]],
  ['Decay', 0xd1, [['value', 'u8']]],
  ['Sustain', 0xd2, [['value', 'u8']]],
  ['Release', 0xd3, [['value', 'u8']]],
  ['LoopStart', 0xd4, [['count', 'u8']]],
  ['Expression', 0xd5, [['value', 'u8']]],
  ['PrintVar', 0xd6, [['var', 'u8']]],

  ['ModDelay', 0xe0, [['value', 's16']]],
  ['Tempo', 0xe1, [['value', 's16']]],
  ['SweepPitch', 0xe3, [['value', 's16']]],

  ['LoopEnd', 0xfc, []],
  ['Return', 0xfd, []],
  ['AllocateTracks', 0xfe, [['mask', 'u16']]],
  ['Fin', 0xff, []],
];

/** @type {Map<string, {name:string, opcode:number, params:{name:string,kind:string}[]}>} */
export const BY_NAME = new Map();
/** @type {Map<number, {name:string, opcode:number, params:{name:string,kind:string}[]}>} */
export const BY_OPCODE = new Map();

for (const [name, opcode, params] of DEFS) {
  const entry = {
    name,
    opcode,
    params: params.map(([pn, kind]) => ({ name: pn, kind })),
  };
  BY_NAME.set(name, entry);
  BY_OPCODE.set(opcode, entry);
}

/**
 * @param {number} opcode
 * @returns {{name:string, opcode:number, params:{name:string,kind:string}[]}|undefined}
 */
export function lookupOpcode(opcode) {
  return BY_OPCODE.get(opcode);
}

/**
 * @param {string} name
 * @returns {{name:string, opcode:number, params:{name:string,kind:string}[]}|undefined}
 */
export function lookupName(name) {
  return BY_NAME.get(name);
}
