// Utility: which tracks a BCSEQ enables, as a 16-bit "channel flags" bitmask.
//
// A CSEQ always runs an implicit track 0 (the DATA command stream itself); further
// tracks are declared by AllocateTrack (a u16 mask) and started by OpenTrack {track}.
// We OR all three signals together so the result is robust across authoring tools:
// bit i (LSB = track 0) is 1 iff track i is active. BCSEQ caps at 16 tracks, so the
// result always fits a u16.

import { read } from './read.js';

/**
 * Scan a BCSEQ for its active tracks and return the "channel flags" — a bitmask where
 * bit i (bit 0 = track 0, the conductor) is 1 iff track i is enabled.
 *
 * @param {Uint8Array|ArrayBuffer|import('../ir/events.js').Sequence} input BCSEQ bytes
 *   (a CSEQ container) or an already-parsed Sequence.
 * @returns {number} u16 bitmask, e.g. 0b0000011111111111 for tracks 0..10.
 */
export function trackFlags(input) {
  const seq = toSequence(input);
  let flags = 0b1; // track 0 (the conductor stream) always runs
  for (const e of seq.events) {
    if (e.type !== 'Command') continue;
    if (e.name === 'AllocateTrack') flags |= (e.args.mask & 0xffff);
    else if (e.name === 'OpenTrack') flags |= (1 << (e.args.track & 0x0f));
  }
  return flags & 0xffff;
}

/**
 * Format channel flags as a fixed 16-bit binary literal, e.g. "0b0000011111111111".
 * @param {number} flags
 * @returns {string}
 */
export function formatTrackFlags(flags) {
  return '0b' + (flags & 0xffff).toString(2).padStart(16, '0');
}

/** @param {*} input @returns {import('../ir/events.js').Sequence} */
function toSequence(input) {
  if (input && Array.isArray(input.events)) return input;
  const bytes = input instanceof Uint8Array ? input
    : input instanceof ArrayBuffer ? new Uint8Array(input)
      : null;
  if (!bytes) throw new TypeError('trackFlags expects BCSEQ bytes or a parsed Sequence');
  return read(bytes);
}
