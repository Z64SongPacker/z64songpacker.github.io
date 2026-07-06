// 3DS/Wii-U (CTR/Cafe) BCSEQ command table — the single source of truth for
// opcode <-> parameter layout, ported from GotaSequenceLib's CtrCafe platform
// (CommandMap + ExtendedCommands) and SequenceCommand's parameter switch.
//
// CRITICAL: BCSEQ *sequence data* is BIG-ENDIAN (the CSEQ container header is
// little-endian — see read.js/write.js). Every multi-byte parameter here is
// big-endian. Notes (0x00-0x7F) are handled specially by read.js/write.js.
//
// Two opcode spaces:
//   - MAIN: a single status byte.
//   - EXTENDED: status byte 0xF0, then a sub-byte from EXTENDED.
//
// Parameter kinds: u8, s8, bool, u16, s16, vl, offset (u24 big-endian on the
// wire, carried in the IR as a symbolic label name).

import { readVLQ, writeVLQ } from '../bytes/vlq.js';

// Wrapper prefixes. Random/Variable read the wrapped command in "no last param"
// mode (they supply its final parameter); If/Time/TimeRandom/TimeVariable read
// the wrapped command fully and then append their own trailing data.
export const WRAP = {
  0xa0: 'random',       // + min s16, max s16   (inner: drop last param)
  0xa1: 'variable',     // + var u8             (inner: drop last param)
  0xa2: 'if',           // (inner full)
  0xa3: 'time',         // + value s16          (inner full)
  0xa4: 'timeRandom',   // + min s16, max s16   (inner full)
  0xa5: 'timeVariable', // + var u8             (inner full)
};
export const WRAP_OPCODE = {
  random: 0xa0, variable: 0xa1, if: 0xa2, time: 0xa3, timeRandom: 0xa4, timeVariable: 0xa5,
};
export const EXTENDED_PREFIX = 0xf0;

// param helpers (big-endian) ------------------------------------------------
/** @param {import('../bytes/reader.js').Reader} r @param {string} kind */
export function readParam(r, kind) {
  switch (kind) {
    case 'u8': return r.u8();
    case 's8': return r.s8();
    case 'bool': return r.u8();
    case 'u16': return r.u16be();
    case 's16': return r.s16be();
    case 'offset': return r.u24be();
    case 'vl': return readVLQ(r);
    default: throw new Error('unknown param kind: ' + kind);
  }
}
/** @param {import('../bytes/writer.js').Writer} w @param {string} kind @param {number} v */
export function writeParam(w, kind, v) {
  switch (kind) {
    case 'u8': w.u8(v); break;
    case 's8': w.s8(v); break;
    case 'bool': w.u8(v); break;
    case 'u16': w.u16be(v); break;
    case 's16': w.s16be(v); break;
    case 'offset': w.u24be(v); break;
    case 'vl': writeVLQ(w, v); break;
    default: throw new Error('unknown param kind: ' + kind);
  }
}

const V = [['value', 'u8']];       // single u8 value
const B = [['value', 'bool']];     // single bool
const S = [['value', 's8']];       // single s8
const S16 = [['value', 's16']];    // single s16
const VL = [['value', 'vl']];      // single VLQ
const U8S16 = [['var', 'u8'], ['value', 's16']]; // variable ops
const NONE = [];

// MAIN table: [name, opcode, params]
const MAIN_DEFS = [
  ['Wait', 0x80, VL],
  ['ProgramChange', 0x81, VL],
  ['OpenTrack', 0x88, [['track', 'u8'], ['offset', 'offset']]],
  ['Jump', 0x89, [['offset', 'offset']]],
  ['Call', 0x8a, [['offset', 'offset']]],
  // 0xA0-0xA5 are wrappers, handled specially (not here).
  ['Timebase', 0xb0, V],
  ['EnvHold', 0xb1, V],
  ['Monophonic', 0xb2, B],
  ['VelocityRange', 0xb3, V],
  ['BiquadType', 0xb4, V],
  ['BiquadValue', 0xb5, V],
  ['BankSelect', 0xb6, V],
  ['ModPhase', 0xbd, V],
  ['ModCurve', 0xbe, V],
  ['FrontBypass', 0xbf, B],
  ['Pan', 0xc0, V],
  ['Volume', 0xc1, V],
  ['MainVolume', 0xc2, V],
  ['Transpose', 0xc3, S],
  ['PitchBend', 0xc4, S],
  ['BendRange', 0xc5, V],
  ['Prio', 0xc6, V],
  ['NoteWait', 0xc7, B],
  ['Tie', 0xc8, B],
  ['Porta', 0xc9, V],
  ['ModDepth', 0xca, V],
  ['ModSpeed', 0xcb, V],
  ['ModType', 0xcc, V],
  ['ModRange', 0xcd, V],
  ['PortaSw', 0xce, B],
  ['PortaTime', 0xcf, V],
  ['Attack', 0xd0, V],
  ['Decay', 0xd1, V],
  ['Sustain', 0xd2, V],
  ['Release', 0xd3, V],
  ['LoopStart', 0xd4, V],
  ['Volume2', 0xd5, V],
  ['PrintVar', 0xd6, V],
  ['SurroundPan', 0xd7, V],
  ['LpfCutoff', 0xd8, V],
  ['FxSendA', 0xd9, V],
  ['FxSendB', 0xda, V],
  ['MainSend', 0xdb, V],
  ['InitPan', 0xdc, V],
  ['Mute', 0xdd, V],
  ['FxSendC', 0xde, V],
  ['Damper', 0xdf, B],
  ['ModDelay', 0xe0, S16],
  ['Tempo', 0xe1, S16],
  ['SweepPitch', 0xe3, S16],
  ['ModPeriod', 0xe4, S16],
  ['EnvReset', 0xfb, NONE],
  ['LoopEnd', 0xfc, NONE],
  ['Return', 0xfd, NONE],
  ['AllocateTrack', 0xfe, [['mask', 'u16']]],
  ['Fin', 0xff, NONE],
];

// EXTENDED table (behind 0xF0): [name, sub, params]
const EXT_DEFS = [
  ['SetVar', 0x80, U8S16], ['AddVar', 0x81, U8S16], ['SubVar', 0x82, U8S16],
  ['MulVar', 0x83, U8S16], ['DivVar', 0x84, U8S16], ['ShiftVar', 0x85, U8S16],
  ['RandVar', 0x86, U8S16], ['AndVar', 0x87, U8S16], ['OrVar', 0x88, U8S16],
  ['XorVar', 0x89, U8S16], ['NotVar', 0x8a, U8S16], ['ModVar', 0x8b, U8S16],
  ['CmpEq', 0x90, U8S16], ['CmpGe', 0x91, U8S16], ['CmpGt', 0x92, U8S16],
  ['CmpLe', 0x93, U8S16], ['CmpLt', 0x94, U8S16], ['CmpNe', 0x95, U8S16],
  ['Mod2Curve', 0xa0, V], ['Mod2Phase', 0xa1, V], ['Mod2Depth', 0xa2, V],
  ['Mod2Speed', 0xa3, V], ['Mod2Type', 0xa4, V], ['Mod2Range', 0xa5, V],
  ['Mod3Curve', 0xa6, V], ['Mod3Phase', 0xa7, V], ['Mod3Depth', 0xa8, V],
  ['Mod3Speed', 0xa9, V], ['Mod3Type', 0xaa, V], ['Mod3Range', 0xab, V],
  ['Mod4Curve', 0xac, V], ['Mod4Phase', 0xad, V], ['Mod4Depth', 0xae, V],
  ['Mod4Speed', 0xaf, V], ['Mod4Type', 0xb0, V], ['Mod4Range', 0xb1, V],
  ['UserCall', 0xe0, S16], ['Mod2Delay', 0xe1, S16], ['Mod2Period', 0xe2, S16],
  ['Mod3Delay', 0xe3, S16], ['Mod3Period', 0xe4, S16], ['Mod4Delay', 0xe5, S16],
  ['Mod4Period', 0xe6, S16],
];

function buildEntry(name, code, params, extended) {
  return { name, extended, opcode: extended ? undefined : code, sub: extended ? code : undefined,
    params: params.map(([pn, kind]) => ({ name: pn, kind })) };
}

/** @type {Map<string, object>} */
export const BY_NAME = new Map();
/** @type {Map<number, object>} */
export const BY_OPCODE = new Map();
/** @type {Map<number, object>} */
export const BY_EXT_SUB = new Map();

for (const [name, opcode, params] of MAIN_DEFS) {
  const e = buildEntry(name, opcode, params, false);
  BY_NAME.set(name, e);
  BY_OPCODE.set(opcode, e);
}
for (const [name, sub, params] of EXT_DEFS) {
  const e = buildEntry(name, sub, params, true);
  BY_NAME.set(name, e);
  BY_EXT_SUB.set(sub, e);
}

export function lookupName(name) { return BY_NAME.get(name); }
export function lookupOpcode(op) { return BY_OPCODE.get(op); }
export function lookupExtSub(sub) { return BY_EXT_SUB.get(sub); }
