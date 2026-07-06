// Intermediate representation (IR) shared by the SSEQ writer/reader and (later)
// the N64 -> IR bridge.
//
// A Sequence carries a flat, ordered list of events plus the header fields
// needed to reproduce a file byte-exactly. This "assembly-style" flat list is
// what the writer serialises and the reader produces; multi-track structure is
// expressed *within* the list via AllocateTracks / OpenTrack events that point
// at Label events. Labels are symbolic — absolute/relative offsets are resolved
// only at encode time, so nothing here authors a numeric offset by hand.
//
// Event shapes:
//   { type: 'Note',    key, velocity, duration, wrapper? }
//   { type: 'Label',   name }
//   { type: 'Command', name, args: {...}, wrapper? }
//
// `wrapper` (optional) models the Random/Variable/If prefixes:
//   { kind: 'random',   min, max }   // supplies the wrapped command's last param
//   { kind: 'variable', variable }   // supplies the wrapped command's last param
//   { kind: 'if' }                   // gates execution; wrapped params kept intact

export class Sequence {
  constructor() {
    /** @type {object[]} ordered event list */
    this.events = [];
    // Header fields, defaulted for a freshly-authored little-endian file.
    this.byteOrder = 0xfeff;
    this.version = 0x0100;
    this.headerSize = 0x10;
    this.blockCount = 1;
    /** @type {number} byte used to pad the block/file to a 4-byte boundary */
    this.padByte = 0x00;
    /** @type {number} number of pad bytes at the very end (for exact round-trip) */
    this.padLength = 0;
  }

  /**
   * Append an event and return it (for chaining / reference).
   * @template T
   * @param {T} event
   * @returns {T}
   */
  push(event) {
    this.events.push(event);
    return event;
  }
}

// --- Event factory functions ------------------------------------------------
// These return plain objects; the writer switches on `type`. Convenience
// helpers cover the musically-meaningful commands; `command()` builds any entry
// from the command table generically.

/**
 * @param {number} key note number 0-127
 * @param {number} velocity 0-127
 * @param {number} duration ticks (VL-encoded)
 */
export function note(key, velocity, duration) {
  return { type: 'Note', key, velocity, duration };
}

/** @param {string} name */
export function label(name) {
  return { type: 'Label', name };
}

/**
 * Generic command event.
 * @param {string} name command name from the table (e.g. 'Pan', 'Jump')
 * @param {Record<string, number|string>} [args] parameter values by name;
 *        offset params take a label name (string)
 */
export function command(name, args = {}) {
  return { type: 'Command', name, args };
}

// Named conveniences (all thin wrappers over command()).
export const wait = (ticks) => command('Wait', { ticks });
export const pan = (value) => command('Pan', { value });
export const volume = (value) => command('Volume', { value });
export const mainVolume = (value) => command('MainVolume', { value });
export const tempo = (value) => command('Tempo', { value });
export const transpose = (value) => command('Transpose', { value });
export const noteWait = (on) => command('NoteWait', { value: on ? 1 : 0 });
export const jump = (labelName) => command('Jump', { offset: labelName });
export const call = (labelName) => command('Call', { offset: labelName });
export const openTrack = (track, labelName) => command('OpenTrack', { track, offset: labelName });
export const allocateTracks = (mask) => command('AllocateTracks', { mask });
export const loopStart = (count) => command('LoopStart', { count });
export const loopEnd = () => command('LoopEnd', {});
export const ret = () => command('Return', {});
export const fin = () => command('Fin', {});

/**
 * Attach a Random wrapper to an event (it supplies the command's last param).
 * @template T
 * @param {T} event
 * @param {number} min
 * @param {number} max
 * @returns {T}
 */
export function withRandom(event, min, max) {
  event.wrapper = { kind: 'random', min, max };
  return event;
}

/**
 * Attach a Variable wrapper (sources the command's last param from a variable).
 * @template T
 * @param {T} event
 * @param {number} variable
 * @returns {T}
 */
export function withVariable(event, variable) {
  event.wrapper = { kind: 'variable', variable };
  return event;
}

/**
 * Attach an If wrapper (gates execution; keeps all wrapped params).
 * @template T
 * @param {T} event
 * @returns {T}
 */
export function withIf(event) {
  event.wrapper = { kind: 'if' };
  return event;
}
