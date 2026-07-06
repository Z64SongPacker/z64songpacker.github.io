// N64 Audioseq (Zelda64 MML) command table — the single source of truth for the
// three code sections' opcode -> argument layout. Transcribed from the OoT decomp
// (`include/audio/aseq.h` + `tools/audio/extraction/disassemble_sequence.py`), OoT
// (MML_VERSION_OOT) only. See docs/n64seq-notes.md.
//
// CRITICAL: Audioseq is BIG-ENDIAN and has NO file header — execution begins at
// offset 0 in the SEQ section. Pointers are absolute u16 offsets from offset 0
// (ldchan/ldlayer/jump/call/beqz/bltz/bgez); rjump/rbeqz/rbltz are s8-relative and
// rldchan/rldlayer are s16-relative, both measured from just after the offset bytes.
//
// This table is DECLARATIVE; the byte-level decode loop lives in reader.js. Layer
// note opcodes (0x00-0xBF) are NOT in this table — they depend on the channel's
// short/noshort state and are decoded specially by reader.js.

export const SECTION = { SEQ: 'SEQ', CHAN: 'CHAN', LAYER: 'LAYER' };

// Argument kinds. Fixed-width reads plus the Audioseq variable-length quantity and
// three pointer flavours (each pointer carries the section its target belongs to).
//   'u8' 's8' 'u16' 's16'   — plain big-endian scalars
//   'var'                   — Audioseq VLQ (see readVar in reader.js)
//   'pAbs'                  — u16 absolute offset (target section from def.to)
//   'pRel8' / 'pRel16'      — signed relative offset (target section from def.to)
//   'portTime'              — layer portamento time: u8 if mode&0x80 else var

/**
 * Read the Audioseq variable-length quantity at the cursor.
 * b0; if (b0 & 0x80): value = ((b0<<8)&0x7F00) | next_u8, else value = b0.
 * @param {import('../bytes/reader.js').Reader} r
 * @returns {number}
 */
export function readVar(r) {
  const b0 = r.u8();
  if (b0 & 0x80) return ((b0 << 8) & 0x7f00) | r.u8();
  return b0;
}

// --- Control-flow commands (0xF2-0xFF), shared by all three sections. ---
// `ctrl` classifies flow: 'end' (terminal), 'jump' (unconditional branch),
// 'call' (subroutine), 'branch' (conditional), 'loop'/'loopend'/'break'.
// Pointer targets in this range are always the CURRENT section (def.to = 'SELF').
const CONTROL_FLOW = {
  0xff: { name: 'end', ctrl: 'end', args: [] },
  0xfe: { name: 'delay1', args: [] },
  0xfd: { name: 'delay', args: ['var'] },
  0xfc: { name: 'call', ctrl: 'call', to: 'SELF', args: ['pAbs'] },
  0xfb: { name: 'jump', ctrl: 'jump', to: 'SELF', args: ['pAbs'] },
  0xfa: { name: 'beqz', ctrl: 'branch', to: 'SELF', args: ['pAbs'] },
  0xf9: { name: 'bltz', ctrl: 'branch', to: 'SELF', args: ['pAbs'] },
  0xf8: { name: 'loop', ctrl: 'loop', args: ['u8'] },
  0xf7: { name: 'loopend', ctrl: 'loopend', args: [] },
  0xf6: { name: 'break', ctrl: 'break', args: [] },
  0xf5: { name: 'bgez', ctrl: 'branch', to: 'SELF', args: ['pAbs'] },
  0xf4: { name: 'rjump', ctrl: 'jump', to: 'SELF', args: ['pRel8'] },
  0xf3: { name: 'rbeqz', ctrl: 'branch', to: 'SELF', args: ['pRel8'] },
  0xf2: { name: 'rbltz', ctrl: 'branch', to: 'SELF', args: ['pRel8'] },
};

// --- Ranged commands: the low `nbits` of the opcode byte are a packed argument. ---
// `packed` names the packed value ('chan'/'layer'/'port'); `args` are the bytes
// that follow. base spans [base, base + (1<<nbits) - 1].
const SEQ_RANGED = [
  { base: 0x00, nbits: 4, name: 'testchan', packed: 'chan', args: [] },
  { base: 0x40, nbits: 4, name: 'stopchan', packed: 'chan', args: [] },
  { base: 0x50, nbits: 3, name: 'subio', packed: 'port', args: [] },
  { base: 0x60, nbits: 4, name: 'ldres', packed: 'port', args: ['u8', 'u8'] },
  { base: 0x70, nbits: 3, name: 'stio', packed: 'port', args: [] },
  { base: 0x80, nbits: 3, name: 'ldio', packed: 'port', args: [] },
  { base: 0x90, nbits: 4, name: 'ldchan', packed: 'chan', to: 'CHAN', args: ['pAbs'] },
  { base: 0xa0, nbits: 4, name: 'rldchan', packed: 'chan', to: 'CHAN', args: ['pRel16'] },
  { base: 0xb0, nbits: 4, name: 'ldseq', packed: 'port', args: ['u8', 'u16'] },
];

const CHAN_RANGED = [
  { base: 0x00, nbits: 4, name: 'cdelay', packed: 'chan', args: [] },
  { base: 0x10, nbits: 3, name: 'ldsample', packed: 'port', args: [] }, // inst variant
  { base: 0x18, nbits: 3, name: 'ldsample', packed: 'port', args: [] }, // sfx variant
  { base: 0x20, nbits: 4, name: 'ldchan', packed: 'chan', to: 'CHAN', args: ['pAbs'] },
  { base: 0x30, nbits: 4, name: 'stcio', packed: 'chan', args: ['u8'] },
  { base: 0x40, nbits: 4, name: 'ldcio', packed: 'chan', args: ['u8'] },
  { base: 0x50, nbits: 3, name: 'subio', packed: 'port', args: [] },
  { base: 0x60, nbits: 3, name: 'ldio', packed: 'port', args: [] },
  { base: 0x70, nbits: 3, name: 'stio', packed: 'port', args: [] },
  { base: 0x78, nbits: 3, name: 'rldlayer', packed: 'layer', to: 'LAYER', args: ['pRel16'] },
  { base: 0x80, nbits: 3, name: 'testlayer', packed: 'layer', args: [] },
  { base: 0x88, nbits: 3, name: 'ldlayer', packed: 'layer', to: 'LAYER', args: ['pAbs'] },
  { base: 0x90, nbits: 3, name: 'dellayer', packed: 'layer', args: [] },
  { base: 0x98, nbits: 3, name: 'dynldlayer', packed: 'layer', args: [] },
];

// Layer ldshortvel/ldshortgate pack a 4-bit port into the opcode.
const LAYER_RANGED = [
  { base: 0xd0, nbits: 4, name: 'ldshortvel', packed: 'port', args: [] },
  { base: 0xe0, nbits: 4, name: 'ldshortgate', packed: 'port', args: [] },
];

// --- Fixed-opcode commands, one exact byte. ---
const SEQ_FIXED = {
  0xc4: { name: 'runseq', args: ['u8', 'u8'] },
  0xc5: { name: 'scriptctr', args: ['u16'] },
  0xc6: { name: 'stop', args: [] },
  0xc7: { name: 'stseq', args: ['u8', 'u16'] },
  0xc8: { name: 'sub', args: ['u8'] },
  0xc9: { name: 'and', args: ['u8'] },
  0xcc: { name: 'ldi', args: ['u8'] },
  0xcd: { name: 'dyncall', to: 'TABLE', args: ['u16'] },
  0xce: { name: 'rand', args: ['u8'] },
  0xd0: { name: 'notealloc', args: ['u8'] },
  0xd1: { name: 'ldshortgatearr', to: 'ARRAY', args: ['u16'] },
  0xd2: { name: 'ldshortvelarr', to: 'ARRAY', args: ['u16'] },
  0xd3: { name: 'mutebhv', args: ['u8'] },
  0xd4: { name: 'mute', args: [] },
  0xd5: { name: 'mutescale', args: ['s8'] },
  0xd6: { name: 'freechan', args: ['u16'] },
  0xd7: { name: 'initchan', args: ['u16'] },
  0xd9: { name: 'volscale', args: ['u8'] },
  0xda: { name: 'volmode', args: ['u8', 's16'] },
  0xdb: { name: 'vol', args: ['u8'] },
  0xdc: { name: 'tempochg', args: ['s8'] },
  0xdd: { name: 'tempo', args: ['u8'] },
  0xde: { name: 'rtranspose', args: ['s8'] },
  0xdf: { name: 'transpose', args: ['s8'] },
  0xef: { name: 'unk_EF', args: ['s16', 'u8'] },
  0xf0: { name: 'freenotelist', args: [] },
  0xf1: { name: 'allocnotelist', args: ['u8'] },
};

const CHAN_FIXED = {
  0xb0: { name: 'ldfilter', to: 'FILTER', args: ['u16'] },
  0xb1: { name: 'freefilter', args: [] },
  0xb2: { name: 'ldseqtoptr', to: 'TABLE', args: ['u16'] },
  0xb3: { name: 'filter', args: ['u8'] },
  0xb4: { name: 'ptrtodyntbl', args: [] },
  0xb5: { name: 'dyntbltoptr', args: [] },
  0xb6: { name: 'dyntblv', args: [] },
  0xb7: { name: 'randtoptr', args: ['u16'] },
  0xb8: { name: 'rand', args: ['u8'] },
  0xb9: { name: 'randvel', args: ['u8'] },
  0xba: { name: 'randgate', args: ['u8'] },
  0xbb: { name: 'combfilter', args: ['u8', 'u16'] },
  0xbc: { name: 'ptradd', args: ['u16'] },
  0xbd: { name: 'randptr', args: ['u16', 'u16'] },
  0xc1: { name: 'instr', args: ['u8'] },
  0xc2: { name: 'dyntbl', to: 'TABLE', args: ['u16'] },
  0xc3: { name: 'short', args: [] },
  0xc4: { name: 'noshort', args: [] },
  0xc5: { name: 'dyntbllookup', args: [] },
  0xc6: { name: 'font', args: ['u8'] },
  0xc7: { name: 'stseq', args: ['u8', 'u16'] },
  0xc8: { name: 'sub', args: ['u8'] },
  0xc9: { name: 'and', args: ['u8'] },
  0xca: { name: 'mutebhv', args: ['u8'] },
  0xcb: { name: 'ldseq', args: ['u16'] },
  0xcc: { name: 'ldi', args: ['u8'] },
  0xcd: { name: 'stopchan', args: ['u8'] },
  0xce: { name: 'ldptr', args: ['u16'] },
  0xcf: { name: 'stptrtoseq', args: ['u16'] },
  0xd0: { name: 'effects', args: ['u8'] },
  0xd1: { name: 'notealloc', args: ['u8'] },
  0xd2: { name: 'sustain', args: ['u8'] },
  0xd3: { name: 'bend', args: ['s8'] },
  0xd4: { name: 'reverb', args: ['u8'] },
  0xd7: { name: 'vibfreq', args: ['u8'] },
  0xd8: { name: 'vibdepth', args: ['u8'] },
  0xd9: { name: 'releaserate', args: ['u8'] },
  0xda: { name: 'env', to: 'ENVELOPE', args: ['u16'] },
  0xdb: { name: 'transpose', args: ['s8'] },
  0xdc: { name: 'panweight', args: ['u8'] },
  0xdd: { name: 'pan', args: ['u8'] },
  0xde: { name: 'freqscale', args: ['u16'] },
  0xdf: { name: 'vol', args: ['u8'] },
  0xe0: { name: 'volexp', args: ['u8'] },
  0xe1: { name: 'vibfreqgrad', args: ['u8', 'u8', 'u8'] },
  0xe2: { name: 'vibdepthgrad', args: ['u8', 'u8', 'u8'] },
  0xe3: { name: 'vibdelay', args: ['u8'] },
  0xe4: { name: 'dyncall', args: [] },
  0xe5: { name: 'reverbidx', args: ['u8'] },
  0xe6: { name: 'samplebook', args: ['u8'] },
  0xe7: { name: 'ldparams', args: ['u16'] },
  0xe8: { name: 'params', args: ['u8', 'u8', 'u8', 's8', 's8', 'u8', 'u8', 'u8'] },
  0xe9: { name: 'notepri', args: ['u8'] },
  0xea: { name: 'stop', args: [] },
  0xeb: { name: 'fontinstr', args: ['u8', 'u8'] },
  0xec: { name: 'vibreset', args: [] },
  0xed: { name: 'gain', args: ['u8'] },
  0xee: { name: 'bendfine', args: ['s8'] },
  0xf0: { name: 'freenotelist', args: [] },
  0xf1: { name: 'allocnotelist', args: ['u8'] },
};

const LAYER_FIXED = {
  0xc0: { name: 'ldelay', args: ['var'] },
  0xc1: { name: 'shortvel', args: ['u8'] },
  0xc2: { name: 'transpose', args: ['s8'] },
  0xc3: { name: 'shortdelay', args: ['var'] },
  0xc4: { name: 'legato', args: [] },
  0xc5: { name: 'nolegato', args: [] },
  0xc6: { name: 'instr', args: ['u8'] },
  0xc7: { name: 'portamento', args: ['u8', 'u8', 'portTime'] },
  0xc8: { name: 'noportamento', args: [] },
  0xc9: { name: 'shortgate', args: ['u8'] },
  0xca: { name: 'notepan', args: ['u8'] },
  0xcb: { name: 'env', to: 'ENVELOPE', args: ['u16', 'u8'] },
  0xcc: { name: 'nodrumpan', args: [] },
  0xcd: { name: 'stereo', args: ['u8'] },
  0xce: { name: 'bendfine', args: ['s8'] },
  0xcf: { name: 'releaserate', args: ['u8'] },
};

/**
 * Per-section table: fixed opcodes, ranged opcodes, plus the shared control flow.
 * @param {string} section one of SECTION
 * @param {number} byte opcode byte
 * @returns {{def: object, packedValue: number}|null}
 */
export function lookup(section, byte) {
  // Control flow (0xF2-0xFF) is shared and takes precedence.
  if (CONTROL_FLOW[byte]) return { def: CONTROL_FLOW[byte], packedValue: 0 };

  const fixed = section === SECTION.SEQ ? SEQ_FIXED
    : section === SECTION.CHAN ? CHAN_FIXED : LAYER_FIXED;
  if (fixed[byte]) return { def: fixed[byte], packedValue: 0 };

  const ranged = section === SECTION.SEQ ? SEQ_RANGED
    : section === SECTION.CHAN ? CHAN_RANGED : LAYER_RANGED;
  for (const r of ranged) {
    const span = 1 << r.nbits;
    if (byte >= r.base && byte < r.base + span) {
      return { def: r, packedValue: byte - r.base };
    }
  }
  return null;
}
