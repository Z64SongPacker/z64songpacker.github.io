// N64 -> 3DS drum-note key remapping.
//
// WHY: a drum channel's note "pitch" is not a musical pitch — it indexes a drum-kit
// soundfont, one sample per key. The OoT3D drum kits hold the SAME instruments as the
// N64 kits but at DIFFERENT key positions, and their pitch is usually INVERTED. So a
// drum-channel note must be moved to the 3DS position of the SAME instrument; melodic
// notes (program != 0x7F) are untouched.
//
// DIRECTION (this bit was inverted before — see the two sources):
//   - The instrument GIST (#drum-drum-sets) gives the N64 SOURCE ranges (the note
//     layout of the original .seq) per kit + instrument name.
//   - docs/drums.md gives the 3DS DESTINATION ranges per instrument + how to move each
//     (in order = "correct pitch", or reversed = "inverse pitch"), plus "Ignore" rows.
//
// ALGORITHM (per note k in an original .seq drum channel):
//   1. Find k's instrument by its N64 range (gist).
//   2. Find that instrument's 3DS range (docs/drums.md) and move k there (same length,
//      inverse or in-order). e.g. Orchestra N64 37 is "Snare High" (gist 37-38); its
//      3DS range is 29-30, inverse -> 37 becomes 30.
//   3. A note that maps to (or falls in) an "Ignore" range, or that is outside every
//      instrument range for the kit, is DROPPED — never emitted (docs/drums.md: an
//      Ignore range "doesn't exist"). Undocumented kits keep their notes as-is.
//
// Each rule is an N64 SOURCE range with how to place it in 3DS:
//   { lo, hi, kind:'inv', dsHi }  -> dsHi - (k - lo)   (same instrument, inverse pitch)
//   { lo, hi, kind:'lin', dsLo }  -> dsLo + (k - lo)   (same instrument, in order)
//   { lo, hi, kind:'to',  to }    -> to                (collapse to one 3DS key)
// A note outside every rule of a documented kit -> null (drop). Range lengths are equal
// on both sides for inv/lin (verified against gist + docs/drums.md).
//
// docs/drums.md is partly incomplete/ambiguous (Conga Open/Slap "exceptions doc later";
// Tambourine head-tap keeps only its 2 surviving 3DS notes; Lute Tambourine and
// Gong/Windchimes have no table -> pass-through). Those are best-effort / pass-through.

const KITS = {
  // Orchestra Kit. N64 (gist): TimpaniLow 21-36, SnareHigh 37-38, SnareLow 39-41,
  // Crash 42-53, TimpaniHigh 54-84.  3DS (docs/drums.md, all inverse): 13-28, 29-30,
  // 31-33, 34-45, 47-77 (3DS 46 is a dead Timpani Low slot -> never a target).
  orchestra: [
    { lo: 26, hi: 36, kind: 'inv', dsHi: 27 }, // Timpani Low  -> 3DS 13-27
    { lo: 21, hi: 25, kind: 'to', to: 28 }, // Timpani Low -> Anything lower clamp to 28
    { lo: 37, hi: 38, kind: 'inv', dsHi: 30 }, // Snare High   -> 3DS 29-30
    { lo: 39, hi: 41, kind: 'inv', dsHi: 33 }, // Snare Low    -> 3DS 31-33
    { lo: 42, hi: 45, kind: 'inv', dsHi: 45 }, // Crash Cymbal -> Anything lower clamp to 45
    { lo: 46, hi: 53, kind: 'inv', dsHi: 45 }, // Crash Cymbal -> 3DS 34-45
    { lo: 54, hi: 59, kind: 'to', dsHi: 76 }, // Timpani High -> Anything lower clamp to 76
    { lo: 60, hi: 84, kind: 'inv', dsHi: 76 }, // Timpani High -> 3DS 47-77
    //{ lo: 54, hi: 84, kind: 'inv', dsHi: 77 }, // Timpani High -> 3DS 47-77
  ],

  // Tambourine. N64 (gist): EdgeSlap 21-47, HeadSlap 48-49, HeadTap 50-73.  3DS:
  // EdgeSlap 1-27 (in order), HeadSlap 54-55 (inverse), HeadTap keeps only 2 surviving
  // 3DS notes (N64 50->56, 52->57, and any note past 52 clamps to 57). 3DS Cowbell
  // 28-53 and HeadTap 58-90 are Ignore -> never targeted.
  tambourine: [
    { lo: 21, hi: 47, kind: 'lin', dsLo: 1 },  // Edge Slap -> 3DS 1-27 (in order)
    { lo: 48, hi: 49, kind: 'inv', dsHi: 55 }, // Head Slap -> 3DS 54-55 (inverse)
    { lo: 50, hi: 51, kind: 'to', to: 56 },    // Head Tap  -> surviving 3DS 56
    { lo: 52, hi: 73, kind: 'to', to: 57 },    // Head Tap  -> surviving 3DS 57 (clamp)
  ],

  // Conga / Shaker. N64 (gist): CongaMute 21-41, CongaOpen 42-60, CongaSlap 61-80,
  // Shaker 81-84.  3DS (all inverse): 25-45, 46-64, 65-84, 85-88.
  congaShaker: [
    { lo: 21, hi: 41, kind: 'inv', dsHi: 45 }, // Conga Mute -> 3DS 25-45
    { lo: 42, hi: 60, kind: 'inv', dsHi: 64 }, // Conga Open -> 3DS 46-64
    { lo: 61, hi: 80, kind: 'inv', dsHi: 84 }, // Conga Slap -> 3DS 65-84
    { lo: 81, hi: 84, kind: 'inv', dsHi: 88 }, // Shaker     -> 3DS 85-88
  ],

  // Trip Hopping. N64 (gist): Kick 21-37, Snare 38-62.  3DS: Kick 17-33 (inverse),
  // Snare has only ONE surviving 3DS note (34); 3DS 35-80 is Ignore.
  tripHopping: [
    { lo: 21, hi: 37, kind: 'inv', dsHi: 33 }, // Kick  -> 3DS 17-33
    { lo: 38, hi: 62, kind: 'to', to: 34 },    // Snare -> the one surviving 3DS note 34
  ],

  // No table in docs/drums.md yet -> pass everything through (keep notes as-is).
  luteTambourine: [],
  gongWindchimes: [],
};

/** Known drum-kit ids. */
export const DRUM_KITS = Object.keys(KITS);

// Which drum kit a bank's 0x7F slot uses (from the gist's per-bank instrument lists).
// Banks without a 0x7F drum kit are absent. Values are keys of KITS.
export const BANK_DRUM_KITS = {
  0x03: 'orchestra', 0x05: 'tambourine', 0x07: 'tripHopping', 0x08: 'tambourine',
  0x09: 'orchestra', 0x0a: 'luteTambourine', 0x10: 'gongWindchimes', 0x12: 'orchestra',
  0x14: 'orchestra', 0x15: 'congaShaker', 0x16: 'congaShaker', 0x1d: 'gongWindchimes',
  0x20: 'orchestra', 0x21: 'orchestra', 0x22: 'orchestra', 0x23: 'orchestra',
};

/**
 * The drum kit a bank uses at program 0x7F, or null if the bank has no drum kit.
 * @param {number} bankId
 * @returns {string|null}
 */
export function drumKitForBank(bankId) {
  return BANK_DRUM_KITS[bankId] || null;
}

/**
 * Build a drum-channel note-key remap for the given kit. Applied ONLY to notes on a
 * drum channel (N64 program 0x7F), to the RAW N64 note key (percussion notes index a
 * sample table, so channel/layer transpose does not apply).
 *
 * Returns a function `(key) => number | null`: the 3DS key for the same instrument, or
 * `null` to DROP the note (a documented kit's note that has no surviving 3DS slot — it
 * would land in an "Ignore" range). Undocumented/unknown kits return the key unchanged.
 *
 * @param {string} kit one of DRUM_KITS
 * @returns {(key:number)=>(number|null)}
 */
export function makeDrumKeyRemap(kit) {
  const rules = KITS[kit];
  if (!rules || rules.length === 0) return (key) => key; // undocumented/unknown -> identity
  return (key) => {
    for (const r of rules) {
      if (key < r.lo || key > r.hi) continue;
      switch (r.kind) {
        case 'inv': return r.dsHi - (key - r.lo);
        case 'lin': return r.dsLo + (key - r.lo);
        default: return r.to; // 'to'
      }
    }
    return null; // no surviving 3DS instrument for this note -> drop it
  };
}
