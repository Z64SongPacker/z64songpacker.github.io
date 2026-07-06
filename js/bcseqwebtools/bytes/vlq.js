// SSEQ variable-length quantity (VL / VLQ), MIDI-style.
//
// 7 data bits per byte, most-significant group first. The high bit (0x80) of a
// byte means "another byte follows". The last byte has its high bit clear.
// Valid range is 0 .. 0x0FFFFFFF (268435455), i.e. at most 4 bytes.

export const VLQ_MAX = 0x0fffffff;

/**
 * Encode a non-negative integer as a VL byte sequence.
 * @param {number} value 0 .. 0x0FFFFFFF
 * @returns {number[]} the VL bytes (1..4 of them)
 */
export function encodeVLQ(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError('VLQ value must be a non-negative integer: ' + value);
  }
  if (value > VLQ_MAX) {
    throw new RangeError('VLQ value out of range (max 0x0FFFFFFF): ' + value);
  }
  // Build 7-bit groups, most significant first.
  const out = [value & 0x7f];
  let v = value;
  while ((v >>>= 7) > 0) {
    // Prepend the next group with its continuation bit set.
    out.unshift((v & 0x7f) | 0x80);
  }
  return out;
}

/**
 * Write a VL value to a Writer.
 * @param {import('./writer.js').Writer} writer
 * @param {number} value
 * @returns {import('./writer.js').Writer}
 */
export function writeVLQ(writer, value) {
  const bytes = encodeVLQ(value);
  for (let i = 0; i < bytes.length; i++) writer.u8(bytes[i]);
  return writer;
}

/**
 * Decode a VL value from a Reader at its current cursor.
 * @param {import('./reader.js').Reader} reader
 * @returns {number} the decoded value; the cursor advances past the VL bytes
 */
export function readVLQ(reader) {
  let value = 0;
  let count = 0;
  for (;;) {
    const b = reader.u8();
    value = (value << 7) | (b & 0x7f);
    count++;
    if ((b & 0x80) === 0) break;
    if (count >= 4) {
      throw new RangeError('VLQ too long (>4 bytes) at offset ' + (reader.pos - count));
    }
  }
  return value >>> 0;
}

/**
 * Decode a VL value from a raw byte array at `offset`.
 * @param {Uint8Array|number[]} bytes
 * @param {number} [offset]
 * @returns {{value:number, length:number}} the value and how many bytes it used
 */
export function decodeVLQ(bytes, offset = 0) {
  let value = 0;
  let i = offset;
  let count = 0;
  for (;;) {
    if (i >= bytes.length) throw new RangeError('VLQ read past end at ' + i);
    const b = bytes[i++];
    value = (value << 7) | (b & 0x7f);
    count++;
    if ((b & 0x80) === 0) break;
    if (count >= 4) throw new RangeError('VLQ too long (>4 bytes) at offset ' + offset);
  }
  return { value: value >>> 0, length: i - offset };
}
