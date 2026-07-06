// Byte cursor over a Uint8Array with explicit, endianness-labelled reads.
//
// Every integer read states its endianness in the method name (BE/LE). N64
// Audioseq is big-endian; NDS SSEQ is little-endian. Nothing here relies on the
// platform default — DataView is used with an explicit littleEndian flag.

export class Reader {
  /**
   * @param {Uint8Array} bytes
   * @param {number} [offset] starting cursor position (default 0)
   */
  constructor(bytes, offset = 0) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('Reader expects a Uint8Array');
    }
    this.bytes = bytes;
    /** @type {DataView} */
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    /** @type {number} current read position, relative to the Uint8Array start */
    this.pos = offset;
  }

  /** @returns {number} bytes remaining from the cursor to the end */
  get remaining() {
    return this.bytes.length - this.pos;
  }

  /** @returns {boolean} true if the cursor is at or past the end */
  get eof() {
    return this.pos >= this.bytes.length;
  }

  /**
   * Move the cursor to an absolute position.
   * @param {number} pos
   * @returns {this}
   */
  seek(pos) {
    if (pos < 0 || pos > this.bytes.length) {
      throw new RangeError('seek out of range: ' + pos);
    }
    this.pos = pos;
    return this;
  }

  /**
   * Advance the cursor without reading.
   * @param {number} n
   * @returns {this}
   */
  skip(n) {
    return this.seek(this.pos + n);
  }

  _need(n) {
    if (this.pos + n > this.bytes.length) {
      throw new RangeError(
        'read past end: need ' + n + ' byte(s) at ' + this.pos +
        ', only ' + this.remaining + ' remaining'
      );
    }
  }

  /** @returns {number} next unsigned byte, cursor advances 1 */
  u8() {
    this._need(1);
    return this.bytes[this.pos++];
  }

  /** @returns {number} next signed byte, cursor advances 1 */
  s8() {
    this._need(1);
    return this.view.getInt8(this.pos++);
  }

  /** @returns {number} unsigned 16-bit big-endian */
  u16be() {
    this._need(2);
    const v = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return v;
  }

  /** @returns {number} unsigned 16-bit little-endian */
  u16le() {
    this._need(2);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  /** @returns {number} signed 16-bit big-endian */
  s16be() {
    this._need(2);
    const v = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return v;
  }

  /** @returns {number} signed 16-bit little-endian */
  s16le() {
    this._need(2);
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }

  /** @returns {number} unsigned 24-bit big-endian */
  u24be() {
    this._need(3);
    const b = this.bytes;
    const v = (b[this.pos] << 16) | (b[this.pos + 1] << 8) | b[this.pos + 2];
    this.pos += 3;
    return v >>> 0;
  }

  /** @returns {number} unsigned 24-bit little-endian */
  u24le() {
    this._need(3);
    const b = this.bytes;
    const v = b[this.pos] | (b[this.pos + 1] << 8) | (b[this.pos + 2] << 16);
    this.pos += 3;
    return v >>> 0;
  }

  /** @returns {number} unsigned 32-bit big-endian */
  u32be() {
    this._need(4);
    const v = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return v >>> 0;
  }

  /** @returns {number} unsigned 32-bit little-endian */
  u32le() {
    this._need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v >>> 0;
  }

  /**
   * Read `n` raw bytes as a subarray view (no copy).
   * @param {number} n
   * @returns {Uint8Array}
   */
  bytesOf(n) {
    this._need(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /**
   * Read `n` bytes as an ASCII string (used for the SSEQ/DATA magics).
   * @param {number} n
   * @returns {string}
   */
  ascii(n) {
    this._need(n);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.bytes[this.pos + i]);
    this.pos += n;
    return s;
  }
}
