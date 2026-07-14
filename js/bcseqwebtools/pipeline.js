// Public pipeline: N64 Audioseq bytes -> 3DS BCSEQ bytes, entirely client-side.
//
//   seqToBcseq(bytes)  ==  writeBcseq(toIr(readN64(bytes)))
//
// Pure: Uint8Array in -> Uint8Array out. No DOM/file/Node I/O (that lives in io.js).
// See src/n64/toIr.js for the N64->IR mapping and the extension seams.

import { read as readN64 } from './n64/reader.js';
import { toIr } from './n64/toIr.js';
import { write as writeBcseq } from './bcseq/write.js';
import { makeProgramRemap } from './n64/banks.js';

/**
 * Convert an N64 Audioseq sequence binary to a 3DS `.bcseq` (CSEQ) binary.
 *
 * Looping is intrinsic — it is taken from the source `.seq` (its seq-section backward
 * jump, honouring the intro/loop point), not a caller option.
 *
 * @param {Uint8Array|ArrayBuffer} input raw N64 sequence bytes
 * @param {object} [opts]
 * @param {number} [opts.bank] OoT bank id (e.g. 0x03) — selects the built-in
 *   program-compaction remap AND the drum kit (the bank's 0x7F slot). Bank 0x00 is the
 *   Sound Effects bank, split across four 3DS banks: its programs are routed with
 *   BankSelect per docs/sfx-banks.md (and its chiptunes go to bank index 3). Ignored for
 *   programs if `remapProgram` is given, for drums if `drumKit`/`remapDrumKey` is given.
 * @param {(program:number)=>number} [opts.remapProgram] bank/instrument remap seam
 *   (overrides `opts.bank`).
 * @param {string} [opts.drumKit] drum-kit id to remap drum-channel note keys with
 *   (overrides the bank's default; only affects channels using program 0x7F).
 * @param {(key:number)=>number} [opts.remapDrumKey] explicit drum-note key remap
 *   (overrides `opts.drumKit`).
 * @param {(seq:import('./ir/events.js').Sequence)=>import('./ir/events.js').Sequence} [opts.fixLoops]
 *   optional post-pass over the built IR.
 * @param {number} [opts.n64Timebase] source tatums per beat (default 48)
 * @param {number} [opts.bcseqTimebase] target ticks per beat (default 48)
 * @returns {Uint8Array} BCSEQ bytes
 */
export function seqToBcseq(input, opts = {}) {
  const bytes = input instanceof Uint8Array ? input
    : input instanceof ArrayBuffer ? new Uint8Array(input)
      : null;
  if (!bytes) throw new TypeError('seqToBcseq expects a Uint8Array or ArrayBuffer');
  // An explicit remapProgram wins; otherwise a `bank` selects the built-in compaction
  // table. Neither -> toIr's identity default (programs pass through). The drum kit is
  // derived from `bank` inside toIr (or from opts.drumKit/remapDrumKey).
  const remapProgram = opts.remapProgram
    || (opts.bank != null ? makeProgramRemap(opts.bank) : undefined);
  const model = readN64(bytes);
  const seq = toIr(model, { ...opts, remapProgram });
  return writeBcseq(seq);
}
