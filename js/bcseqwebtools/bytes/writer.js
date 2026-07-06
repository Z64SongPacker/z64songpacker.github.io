// Growable byte writer with explicit endianness and placeholder/patch support.
//
// The patch mechanism lets the SSEQ writer reserve an offset field (u24/u32),
// keep writing, then back-patch the field once the real value is known — e.g. a
// track's absolute data offset, the DATA block size, or the total file size.

export class Writer {
  /**
   * @param {number} [initialCapacity]
   */
  constructor(initialCapacity = 256) {
    this._buf = new Uint8Array(initialCapacity);
    /** @type {DataView} */
    this._view = new DataView(this._buf.buffer);
    /** @type {number} number of bytes written so far */
    this.length = 0;
  }

  /** @returns {number} the current write position (== length) */
  get pos() {
    return this.length;
  }

  _ensure(extra) {
    const need = this.length + extra;
    if (need <= this._buf.length) return;
    let cap = this._buf.length * 2;
    while (cap < need) cap *= 2;
    const bigger = new Uint8Array(cap);
    bigger.set(this._buf.subarray(0, this.length));
    this._buf = bigger;
    this._view = new DataView(this._buf.buffer);
  }

  /**
   * @param {number} v unsigned byte
   * @returns {this}
   */
  u8(v) {
    this._ensure(1);
    this._buf[this.length++] = v & 0xff;
    return this;
  }

  /**
   * @param {number} v signed byte
   * @returns {this}
   */
  s8(v) {
    this._ensure(1);
    this._view.setInt8(this.length, v);
    this.length += 1;
    return this;
  }

  /** @param {number} v @returns {this} */
  u16be(v) {
    this._ensure(2);
    this._view.setUint16(this.length, v & 0xffff, false);
    this.length += 2;
    return this;
  }

  /** @param {number} v @returns {this} */
  u16le(v) {
    this._ensure(2);
    this._view.setUint16(this.length, v & 0xffff, true);
    this.length += 2;
    return this;
  }

  /** @param {number} v @returns {this} */
  s16be(v) {
    this._ensure(2);
    this._view.setInt16(this.length, v, false);
    this.length += 2;
    return this;
  }

  /** @param {number} v @returns {this} */
  s16le(v) {
    this._ensure(2);
    this._view.setInt16(this.length, v, true);
    this.length += 2;
    return this;
  }

  /** @param {number} v @returns {this} */
  u24be(v) {
    this._ensure(3);
    this._buf[this.length] = (v >>> 16) & 0xff;
    this._buf[this.length + 1] = (v >>> 8) & 0xff;
    this._buf[this.length + 2] = v & 0xff;
    this.length += 3;
    return this;
  }

  /** @param {number} v @returns {this} */
  u24le(v) {
    this._ensure(3);
    this._buf[this.length] = v & 0xff;
    this._buf[this.length + 1] = (v >>> 8) & 0xff;
    this._buf[this.length + 2] = (v >>> 16) & 0xff;
    this.length += 3;
    return this;
  }

  /** @param {number} v @returns {this} */
  u32be(v) {
    this._ensure(4);
    this._view.setUint32(this.length, v >>> 0, false);
    this.length += 4;
    return this;
  }

  /** @param {number} v @returns {this} */
  u32le(v) {
    this._ensure(4);
    this._view.setUint32(this.length, v >>> 0, true);
    this.length += 4;
    return this;
  }

  /**
   * Append raw bytes.
   * @param {Uint8Array|number[]} bytes
   * @returns {this}
   */
  bytes(bytes) {
    this._ensure(bytes.length);
    this._buf.set(bytes, this.length);
    this.length += bytes.length;
    return this;
  }

  /**
   * Append ASCII (used for the SSEQ/DATA magics). High bytes are masked off.
   * @param {string} s
   * @returns {this}
   */
  ascii(s) {
    this._ensure(s.length);
    for (let i = 0; i < s.length; i++) this._buf[this.length++] = s.charCodeAt(i) & 0xff;
    return this;
  }

  /**
   * Reserve a fixed-width placeholder, returning its start offset for a later
   * patch call. The bytes are written as zeros for now.
   * @param {number} width bytes (e.g. 3 for u24, 4 for u32)
   * @returns {number} the offset of the placeholder's first byte
   */
  reserve(width) {
    const at = this.length;
    this._ensure(width);
    for (let i = 0; i < width; i++) this._buf[this.length++] = 0;
    return at;
  }

  /**
   * Overwrite an already-written field with a value, without moving the cursor.
   * @param {number} offset the field's first byte (typically from reserve())
   * @param {number} v
   * @param {number} width bytes
   * @param {boolean} littleEndian
   * @returns {this}
   */
  patch(offset, v, width, littleEndian) {
    if (offset < 0 || offset + width > this.length) {
      throw new RangeError('patch out of range: offset ' + offset + ' width ' + width);
    }
    if (width === 1) {
      this._buf[offset] = v & 0xff;
    } else if (width === 2) {
      this._view.setUint16(offset, v & 0xffff, littleEndian);
    } else if (width === 3) {
      if (littleEndian) {
        this._buf[offset] = v & 0xff;
        this._buf[offset + 1] = (v >>> 8) & 0xff;
        this._buf[offset + 2] = (v >>> 16) & 0xff;
      } else {
        this._buf[offset] = (v >>> 16) & 0xff;
        this._buf[offset + 1] = (v >>> 8) & 0xff;
        this._buf[offset + 2] = v & 0xff;
      }
    } else if (width === 4) {
      this._view.setUint32(offset, v >>> 0, littleEndian);
    } else {
      throw new RangeError('unsupported patch width: ' + width);
    }
    return this;
  }

  /**
   * Pad with a fill byte until length is a multiple of `align`.
   * @param {number} align
   * @param {number} [fill] default 0x00
   * @returns {this}
   */
  padTo(align, fill = 0x00) {
    while (this.length % align !== 0) this.u8(fill);
    return this;
  }

  /**
   * @returns {Uint8Array} a copy of exactly the written bytes.
   */
  toBytes() {
    return this._buf.slice(0, this.length);
  }
}
