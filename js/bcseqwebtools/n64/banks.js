// OoT instrument-bank tables + the N64->3DS program-number compaction (Phase 7).
//
// WHY: N64 OoT instrument banks leave empty slots between instruments, but the
// 3DS OoT3D banks are SQUASHED (no gaps) — the same instrument therefore sits at a
// LOWER program number on 3DS. Program numbers must be remapped per bank.
//
// Compaction rule (from the user + gist): within a bank, delete the empty melodic
// slots and shift every later instrument DOWN by the number of preceding gaps.
// Equivalently, an occupied melodic slot maps to its RANK among occupied melodic
// slots. The drum kit (N64 program 0x7F) is the LAST slot and is squashed the same
// way, so it lands RIGHT AFTER the last occupied melodic slot — i.e. its 3DS index
// is the COUNT of occupied melodic slots (NOT a fixed 15). It equals 15 only for
// banks that happen to have all 15 melodic slots occupied (e.g. Hyrule Field).
//
// Data source of truth (occupied slots per bank, empties included):
//   https://gist.github.com/CristobalPenaloza/923ffc436c248d3d89dbe87a4059e6bb#sets
//
// Representation: each bank lists ONLY its occupied melodic slots (slot index ->
// instrument name). A missing melodic key (0x00..0x0F) is an empty/absent slot — a
// "gap" that compaction removes. `drum: true` marks banks with a 0x7F drum kit.
// (Names are kept for traceability; only the slot indices drive the remap.)

/**
 * @typedef {object} Bank
 * @property {string} name human-readable bank name
 * @property {Object<number,string>} slots occupied melodic slots (index -> instrument)
 * @property {boolean} drum whether program 0x7F (drum kit) is present
 * @property {number[]} [order] explicit 3DS instrument order (occupied slots, first to
 *   last) — overrides the default ascending-slot compaction for banks whose 3DS layout
 *   reorders instruments (e.g. 0x21 places its Bell last, right before the drums)
 */

/** N64 program number of the drum kit (FONTANY_INSTR_PERCUSSION). */
export const N64_DRUM_PROGRAM = 0x7f;

// --- Chiptune (synth wave) instruments -----------------------------------------------
// N64 exposes 8 chiptune waves at programs 0x80..0x87 in EVERY bank. On 3DS they instead
// live in ONE dedicated bank (the game's bank 4), at the instrument numbers below. So a
// track that selects a chiptune wave must `BankSelect` that bank first, then `BankSelect`
// back to its own bank before playing any normal instrument again. Unlike the melodic
// compaction this mapping is FIXED (not per-bank) and always applied — a chiptune program
// never routes through a per-bank `remapProgram`. Source: docs/sfx-banks.md "Chiptune
// Instruments".
//
// IMPORTANT: `BankSelect` selects by the accompanying cmeta's bank INDEX (0..3), NOT the
// global bank id. Index 0 is always the sequence's main bank; index 1 is always the
// chiptune bank (game bank 4). So chiptune switches to index 1, and switching back is to
// index 0 — the game bank id 4 is only for reference.

/** cmeta bank-list index that holds the chiptune waves (always index 1; game bank 4). */
export const CHIPTUNE_BANK = 0x01;

/** cmeta bank-list index a sequence uses by default (index 0, its main bank). */
export const DEFAULT_BANK = 0x00;

/** N64 chiptune program (0x80..0x87) -> 3DS bank-4 instrument number. */
const CHIPTUNE_INSTR = {
  0x80: 11, // Saw Wave
  0x81: 14, // Triangle Wave
  0x82: 9, //  Sine Wave
  0x83: 17, // Square Wave
  0x84: 12, // Sawtooth Wave
  0x85: 10, // Noisy / Smooth Wave (close enough)
  0x86: 15, // Smooth Square Wave (close enough)
  0x87: 15, // Softer Square (close enough)
};

/**
 * The 3DS bank-4 instrument number for an N64 chiptune program (0x80..0x87), or null when
 * the program is not a chiptune wave (so the caller keeps its normal bank/remap path).
 * @param {number} program N64 program number
 * @returns {number|null}
 */
export function chiptuneInstrument(program) {
  return CHIPTUNE_INSTR[program] != null ? CHIPTUNE_INSTR[program] : null;
}

// --- N64 bank 0x00 (Sound Effects) -> four 3DS banks ---------------------------------
// N64 packs all its sound effects into ONE bank (0x00). On 3DS those SFX are spread across
// FOUR separate banks, so a bank-0x00 song must switch between them with BankSelect. As
// everywhere, BankSelect takes the cmeta bank-list INDEX (0..3), not the game bank id: for
// a bank-0x00 song the cmeta lists game banks [0, 1, 2, 4] at indices [0, 1, 2, 3]. Index
// 3 (game bank 4) is also where this bank's chiptune waves live (so chiptune here uses
// index 3, not the index-1 used by melodic banks). Source: docs/sfx-banks.md
// "Bank 0x00 (Sound Effects)".

/** N64 bank id whose SFX are split across four 3DS banks. */
export const SFX_BANK = 0x00;

/** Game 3DS bank id -> cmeta bank-list index for a bank-0x00 song. */
const SFX_BANK_INDEX = { 0: 0, 1: 1, 2: 2, 4: 3 };

/** BankSelect index of the chiptune bank (game bank 4) for a bank-0x00 song. */
export const SFX_CHIPTUNE_INDEX = SFX_BANK_INDEX[4]; // 3

// N64 bank-0x00 program (DECIMAL SFX id from the doc) -> [3DS game bank, instrument].
// The game bank is turned into a BankSelect index via SFX_BANK_INDEX at lookup time.
// Program 127 (0x7F) is this bank's drum kit (Tambourine/Rain). Chiptunes (0x80..0x87) are
// NOT listed here — they route through chiptuneInstrument to bank index 3 in the router.
const SFX_BANK0 = {
  0: [0, 0], 1: [0, 1], 2: [0, 2], 3: [0, 3], 4: [0, 4], 5: [0, 5], 6: [0, 6], 7: [0, 7],
  8: [0, 9], 9: [0, 10], 10: [0, 11], 11: [0, 8], 12: [0, 12], 13: [0, 13], 14: [0, 14],
  15: [0, 15], 16: [0, 18], 17: [0, 16], 18: [0, 17], 19: [0, 18], 20: [0, 19], 21: [0, 20],
  22: [0, 21], 23: [0, 22], 24: [0, 23], 25: [0, 24],
  26: [1, 0], 27: [1, 1], 28: [1, 2], 29: [1, 3], 30: [1, 4], 31: [1, 5], 32: [1, 7],
  33: [1, 6], 34: [1, 8], 35: [1, 9], 36: [1, 10], 37: [1, 14], 38: [1, 15], 39: [1, 16],
  40: [1, 17], 41: [1, 18], 42: [1, 19], 43: [1, 20], 44: [1, 21],
  45: [2, 0], 46: [2, 33], 47: [2, 1], 48: [2, 2], /* 49 absent */ 50: [2, 3], 51: [2, 4],
  52: [1, 12], 53: [1, 13], 54: [2, 5], 55: [2, 6], 56: [2, 7], 57: [2, 8], 58: [2, 9],
  59: [2, 10], 60: [2, 29], 61: [2, 11], 62: [2, 12], 63: [2, 13], 64: [2, 14], 65: [2, 15],
  66: [2, 16], 67: [2, 17], 68: [2, 18], 69: [2, 19], 70: [2, 20], 71: [2, 21], 72: [2, 22],
  73: [2, 23], 74: [2, 24], 75: [2, 25], 76: [2, 26], 77: [2, 27], 78: [2, 28], 79: [2, 30],
  80: [2, 31], 81: [2, 32],
  82: [4, 8], 83: [4, 7], 84: [4, 0], 85: [4, 5], 86: [4, 6], 87: [4, 1], 88: [4, 2],
  89: [4, 3], 90: [4, 4], 91: [1, 11],
  127: [4, 13], // drum kit of bank 0x00 (N64 program 0x7F)
};

/**
 * Build the program router for a source N64 bank: raw N64 program -> { bank, program },
 * where `bank` is the 3DS BankSelect INDEX to select and `program` the instrument within
 * it. This is the single place bank-switching is decided:
 *  - Chiptune waves (0x80..0x87) -> the chiptune bank (index 1 for melodic banks, index 3
 *    for the SFX bank 0x00), instrument from the fixed chiptune table.
 *  - For the SFX bank 0x00, every other program uses the SFX split table (indices 0..3);
 *    an unlisted program stays on the main bank unchanged.
 *  - For any other bank, programs stay on the main bank (index 0) and route through
 *    `remap` (the per-bank melodic compaction / the caller's remapProgram seam).
 * @param {number|undefined} bankId source N64 bank id (opts.bank), if any
 * @param {(program:number)=>number} remap main-bank program remap
 * @returns {(program:number)=>{bank:number, program:number}}
 */
export function makeProgramRouter(bankId, remap) {
  const sfx = bankId === SFX_BANK;
  const chiptuneIndex = sfx ? SFX_CHIPTUNE_INDEX : CHIPTUNE_BANK;
  return (program) => {
    const chip = chiptuneInstrument(program);
    if (chip != null) return { bank: chiptuneIndex, program: chip };
    if (sfx) {
      const m = SFX_BANK0[program];
      if (m) return { bank: SFX_BANK_INDEX[m[0]], program: m[1] };
      return { bank: DEFAULT_BANK, program }; // unlisted SFX program: leave as-is
    }
    return { bank: DEFAULT_BANK, program: remap(program) };
  };
}

/** @type {Object<number, Bank>} */
export const BANKS = {
  0x03: { name: 'Hyrule Field', drum: true, slots: {
    0x0: 'Piccolo', 0x1: 'Oboe', 0x2: 'Clarinet', 0x3: 'Bassoon', 0x4: 'Horn',
    0x5: 'Trumpet', 0x6: 'Trombone', 0x7: 'Tuba', 0x8: 'Glockenspiel',
    /* 0x9 empty */ 0xa: 'Strings', 0xb: 'Strings', 0xc: 'Strings Pizzicato',
    0xd: 'Piano', 0xe: 'Harp', 0xf: 'Marimba' } },

  0x04: { name: 'Deku Tree', drum: false, slots: {
    0x0: 'Enigmatic', 0x1: 'Enigmatic (Alt)' } },

  0x05: { name: 'Market', drum: true, slots: {
    0x0: 'Dulcimer', 0x1: 'Ocarina', 0x2: 'Bassoon', 0x3: 'Oboe',
    0xc: 'Strings Pizzicato' } },

  0x06: { name: 'Title Screen', drum: false, slots: {
    /* 0x0 empty */ 0x1: 'Ocarina', 0xa: 'Strings', 0xb: 'Strings',
    /* 0xc empty */ 0xd: 'Piano', 0xe: 'Piano (Alt)' } },

  0x07: { name: "Jabu Jabu's Belly", drum: true, slots: {
    0x0: 'Cricket Choir', /* 0x1 empty */ 0x2: 'String Synth',
    0x3: 'Crunch Roar', 0x4: 'Crunch Roar' } },

  0x08: { name: 'Kakariko Village (Guitar)', drum: true, slots: {
    0x0: 'Harmonica', 0x1: 'Nylon Guitar', 0x2: 'Nylon Guitar', 0x3: 'Ocarina',
    0x4: 'Glockenspiel', 0x5: 'Accordion', 0x6: 'Accordion' } },

  0x09: { name: 'Fairy Fountain', drum: true, slots: {
    0x0: 'Harp', 0x1: 'Harp', 0x2: 'Harp', 0x3: 'Harp (Alt)', 0x4: 'Strings (Alt)',
    0x5: 'Ocarina', 0x6: 'Male Choir', 0x7: 'Male Choir', 0x8: 'Glockenspiel',
    /* 0x9 empty */ 0xa: 'Strings', 0xb: 'Strings', 0xc: 'Strings Pizzicato' } },

  0x0a: { name: 'Fire Temple', drum: true, slots: {
    0x0: 'Chant 1 / 2', 0x1: 'Chant 3', 0x2: 'Chant 3', 0x3: 'Bass Marimba',
    /* 0x4 empty */ 0x5: 'Wind', 0x6: 'Metal Bell' } },

  0x0b: { name: "Dodongo's Cavern", drum: false, slots: {
    0x0: 'Wind Roar', 0x1: 'Shine / Lore Drone', 0x2: 'Metal Grind',
    0x3: 'Spaceosphere' } },

  0x0c: { name: 'Forest Temple', drum: false, slots: {
    0x0: 'Voice Pad', 0x1: 'Flute Chant', 0x2: 'Bamboo Chimes' } },

  0x0d: { name: 'Lon Lon Ranch', drum: false, slots: {
    0x0: 'Malon', 0x1: 'Malon', 0x2: 'Sustain Guitar', 0x3: 'Sustain Guitar (Alt)',
    0x4: 'Sustain Guitar (Alt)', 0xb: 'Strings', 0xc: 'Strings', 0xd: 'Fiddle',
    0xe: 'Fiddle', 0xf: 'Bell' } },

  0x0e: { name: 'Goron City', drum: false, slots: {
    0x0: 'Bent Drum', 0x1: 'Conga', 0x2: 'Cuica', 0x3: 'Bass Marimba',
    0x4: 'Bass Marimba' } },

  0x0f: { name: 'Kokiri Forest', drum: false, slots: {
    0x0: 'Piccolo', 0x1: 'Oboe', 0x2: 'Clarinet', 0x3: 'Bassoon', 0x4: 'Horn',
    0x8: 'Glockenspiel', /* 0x9 empty */ 0xa: 'Strings', 0xb: 'Strings',
    0xc: 'Strings Pizzicato', 0xd: 'Harpsichord', 0xe: 'Harp', 0xf: 'Marimba' } },

  0x10: { name: 'Spirit Temple', drum: true, slots: {
    0x0: 'Voice Pad', 0x1: 'String Synth', 0x2: 'Duduk', 0x3: 'Conga',
    0x4: 'String Synth', 0x5: 'Duduk (Alt)' } },

  0x11: { name: 'Horse Race', drum: false, slots: {
    0x0: 'Banjo', 0x1: 'Banjo', 0x5: 'Double Bass Pizzicato', 0x6: 'Harmonica',
    0x7: 'Nylon Guitar', 0xd: 'Fiddle', 0xe: 'Fiddle' } },

  0x12: { name: 'Warp Songs', drum: true, slots: {
    0x0: 'Harp', 0x1: 'Harp', 0x4: 'Strings (Alt)', 0x5: 'Ocarina',
    0x8: 'Glockenspiel', /* 0x9 empty */ 0xa: 'Strings', 0xb: 'Strings',
    0xc: 'Strings Pizzicato' } },

  0x13: { name: 'Goddess Cutscene', drum: false, slots: {
    0x0: 'Female Choir', 0x1: 'Female Choir', 0x2: 'Harp', 0x3: 'Glockenspiel' } },

  0x14: { name: 'Shooting Gallery', drum: true, slots: {
    0x0: 'Piccolo', 0x1: 'Clarinet', 0x2: 'Clarinet', 0x3: 'Accordion',
    0x4: 'Glockenspiel' } },

  0x15: { name: "Zora's Domain", drum: true, slots: {
    0x0: 'Steel Drum', 0x1: 'Voice Pad (Alt)', 0x2: 'Nylon Guitar' } },

  0x16: { name: 'Shop', drum: true, slots: {
    0x0: 'Nylon Guitar', 0x1: 'Accordion', 0x2: 'Double Bass Pizzicato',
    0x3: 'Trombone', 0x4: 'Trumpet', 0xa: 'Cowbell' } },

  0x17: { name: 'Ice Cavern', drum: false, slots: {
    0x0: 'Fantasia', 0x1: 'Fantasia', 0x2: 'Wind', 0x3: 'Fantasia' } },

  0x18: { name: 'Shadow Temple', drum: false, slots: {
    0x0: 'Djembe', 0x1: 'Wind Roar', 0x2: 'Shine / Lore Drone', 0x3: 'Male Choir',
    0x4: 'Female Choir', /* 0x5 empty */ 0x6: 'Chant 3', 0x7: 'Spaceosphere',
    0x8: 'Harpsichord' } },

  0x19: { name: 'Water Temple', drum: false, slots: {
    0x0: 'Piccolo', 0x1: 'Gong / Windchimes', 0x4: 'Fantasia', 0x5: 'Bamboo Chimes',
    0x6: 'Voice Pad', 0x7: 'Dulcimer' } },

  0x1a: { name: 'Piano (Unused)', drum: false, slots: {
    0xd: 'Piano (Alt)', 0xe: 'Piano (Alt)' } },

  0x1b: { name: 'Gerudo Valley', drum: false, slots: {
    0x0: 'Trumpet', 0x1: 'Trombone', 0x2: 'Nylon Guitar', 0x3: 'Nylon Guitar',
    /* 0x4 empty */ 0x5: 'Double Bass Pizzicato', /* 0x6 empty */
    0x7: 'Nylon Guitar', 0xa: 'Clap', 0xb: 'Clap' } },

  0x1c: { name: 'Lakeside Laboratory', drum: false, slots: {
    0x0: 'Dulcimer', 0x1: 'Djembe', /* 0x2 empty */ 0x3: 'Bent Drum',
    0x4: 'Gong / Windchimes' } },

  0x1d: { name: 'Kotake and Koume', drum: true, slots: {
    0x0: 'Dulcimer', 0x1: 'Djembe', 0x5: 'Piccolo', /* 0x6 empty */
    0x7: 'Piccolo', 0xa: 'Strings', 0xb: 'Strings' } },

  0x1e: { name: "Ganon's Castle (Organ)", drum: false, slots: {
    0x0: 'Organ', 0x1: 'Organ', 0x2: 'Organ', /* 0x3 empty */ 0x4: 'Horn' } },

  0x1f: { name: "Inside Ganon's Castle", drum: false, slots: {
    /* 0x0 empty */ 0x1: 'Wind Roar', 0x2: 'Shine / Lore Drone', 0x3: 'Male Choir',
    0x4: 'Piano', 0x5: 'Piano (Alt)', /* 0x6 empty */ 0x7: 'Spaceosphere' } },

  0x20: { name: 'Ganondorf Battle', drum: true, slots: {
    0x0: 'Piccolo', 0x1: 'Female Choir', 0x2: 'Male Choir', /* 0x3 empty */
    0x4: 'Horn', 0x5: 'Trumpet', 0x6: 'Trombone', 0x7: 'Tuba', 0xa: 'Strings',
    0xb: 'Strings', /* 0xc empty */ 0xd: 'Piano', /* 0xe empty */ 0xf: 'Marimba' } },

  0x21: { name: 'Ending sequence 1', drum: true, slots: {
    0x0: 'Malon', 0x1: 'Malon', 0x2: 'Clarinet', /* 0x3 empty */ 0x4: 'Horn',
    0x5: 'Oboe', 0x6: 'Harp', 0x7: 'Fiddle', 0x8: 'Glockenspiel', /* 0x9 empty */
    0xa: 'Strings', 0xb: 'Strings', /* 0xc empty */ 0xd: 'Bell', 0xe: 'Harp',
    0xf: 'Female Choir' },
    // EXCEPTION: on 3DS the Bell (0xD) sits LAST, right before the drums — not in slot
    // order between Strings and Harp. So compaction must place Bell after Harp (0xE) and
    // Female Choir (0xF), which shift down to fill its gap. `order` overrides the default
    // ascending compaction with the real 3DS instrument order.
    order: [0x0, 0x1, 0x2, 0x4, 0x5, 0x6, 0x7, 0x8, 0xa, 0xb, 0xe, 0xf, 0xd] },

  0x22: { name: 'Ending sequence 2', drum: true, slots: {
    0x0: 'Dulcimer', 0x1: 'Ocarina', 0x2: 'Bassoon', 0x3: 'Oboe', 0x4: 'Female Choir',
    0x5: 'Tambourine', 0x6: 'Harp', 0x7: 'Glockenspiel', 0x8: 'Malon', /* 0x9 empty */
    0xa: 'Strings', 0xb: 'Strings', 0xc: 'Strings Pizzicato', 0xd: 'Horn',
    0xe: 'Male Choir', 0xf: 'Cuica' } },

  0x23: { name: 'Fanfares', drum: true, slots: {
    0x5: 'Trumpet', 0x6: 'Trombone', 0x7: 'Tuba', 0x8: 'Glockenspiel',
    /* 0x9 empty */ 0xa: 'Strings', 0xb: 'Strings', 0xe: 'Harp' } },

  0x24: { name: 'Owl', drum: false, slots: {
    /* 0x0 empty */ 0x1: 'Oboe', /* 0x2 empty */ 0x3: 'Bassoon', 0xa: 'Strings',
    0xb: 'Strings', 0xc: 'Strings Pizzicato', /* 0xd empty */ 0xe: 'Harp' } },
};

/** Occupied melodic slot indices of a bank, ascending. */
function occupiedSlots(bank) {
  return Object.keys(bank.slots)
    .map(Number)
    .filter((s) => s < 16)
    .sort((a, b) => a - b);
}

/**
 * Build a per-bank program remap that compacts N64 program numbers to their 3DS
 * positions: each melodic slot maps to its position in the bank's 3DS instrument order
 * (empty slots removed) — normally ascending slot order, but `bank.order` overrides it
 * for banks whose 3DS layout reorders instruments (e.g. 0x21's Bell). The drum kit 0x7F
 * maps to the COUNT of occupied melodic slots (squashed right after the last melodic
 * instrument). Unknown banks and out-of-range programs (SFX 126, synth waves 128+) pass
 * through unchanged — those mappings are not yet confirmed (see PLAN.md Phase 7).
 *
 * @param {number} bankId OoT bank id (e.g. 0x03 for Hyrule Field)
 * @returns {(program:number)=>number}
 */
export function makeProgramRemap(bankId) {
  const bank = BANKS[bankId];
  if (!bank) return (p) => p; // unknown bank -> identity
  const occupied = occupiedSlots(bank);
  const order = bank.order || occupied; // explicit 3DS order, else ascending slot order
  return (program) => {
    if (program === N64_DRUM_PROGRAM) return order.length; // drum -> after last melodic slot
    if (program < 16) {
      const idx = order.indexOf(program);
      if (idx >= 0) return idx; // occupied slot -> its position in the 3DS order
      // Emptied/absent slot (shouldn't be referenced): compact to the sensible position.
      let n = 0;
      for (const s of occupied) { if (s < program) n++; else break; }
      return n;
    }
    return program; // 126 / 128+ / anything else: unconfirmed -> pass through
  };
}
