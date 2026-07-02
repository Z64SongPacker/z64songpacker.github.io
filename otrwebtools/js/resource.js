// Byte-exact port of the Sequence resource format written by
// ZeldaOTRizer::Sequence::WriteResourceData() and its base class
// OTRizer::Resource::WriteHeader() (leggettc18/ZeldaOTRizer + leggettc18/OTRizer,
// as vendored by leggettc18/SequenceOTRizer). See BUILD.md for the full byte
// layout writeup and links to the exact source read while porting this.
//
// All multi-byte fields are little-endian: OTRizer's BinaryWriter only
// byte-swaps when its Endianness differs from Ship::Endianness::Native, and
// the Resource's writer never has SetEndianness() called on it, so it always
// writes in the host's native order. Every realistic build target for SoH
// (x86/x64/ARM64, and wasm32) is little-endian, so this holds universally.

const RESOURCE_TYPE_AUDIO_SEQUENCE = 0x4f534551; // ZeldaOTRizer::ResourceTypes::AudioSequence
const GAME_VERSION_RACHAEL = 2; // ZeldaOTRizer::GameVersions::Rachael (Deckard=0, Roy=1, Rachael=2)
const RESOURCE_VERSION_AUDIO_SEQUENCE = 0; // resourceVersions[AudioSequence] in Types.h
const HEADER_SIZE = 0x40;

/**
 * Parses a .meta sidecar's contents the same way
 * ZeldaOTRizer::Sequence::FromSeqFile does: line 1 is the resource's database
 * name, line 2 is the soundfont index in hex, line 3 (optional, defaults to
 * "bgm") is the sequence type ("bgm" or "fanfare"). Sanitize() in the
 * reference tool only strips a single trailing \r per line (CRLF sidecars).
 */
export function parseMeta(metaText) {
    const lines = metaText.split('\n');
    const stripCr = (s) => (s !== undefined && s.endsWith('\r') ? s.slice(0, -1) : (s ?? ''));

    const name = stripCr(lines[0]);
    const fontIdxHex = stripCr(lines[1]);
    let type = stripCr(lines[2]);
    if (!type) {
        type = 'bgm';
    }
    type = type.toLowerCase();

    const fontIdx = parseInt(fontIdxHex, 16);
    if (Number.isNaN(fontIdx) || fontIdx < 0 || fontIdx > 0xff) {
        throw new Error(`Invalid soundfont index in .meta file: ${JSON.stringify(fontIdxHex)}`);
    }

    return { name, fontIdx, type };
}

/**
 * Normalizes a structured meta object into the same { name, fontIdx, type }
 * shape parseMeta() returns, so callers can build a resource from in-memory
 * fields without hand-formatting a .meta text blob.
 *
 * @param {Object} meta
 * @param {string} meta.name - the resource's database name (meta line 1).
 * @param {number|string} meta.bank - soundfont index. A number is taken
 *   as-is (decimal, 0-255); a string is parsed as hex, matching .meta files.
 * @param {string} [meta.type="bgm"] - "bgm" or "fanfare" (lowercased). Any
 *   non-"bgm" value is treated as fanfare-style caching, exactly as the
 *   reference tool's FromSeqFile does.
 * @returns {{ name: string, fontIdx: number, type: string }}
 */
export function normalizeMeta(meta) {
    if (meta == null || typeof meta.name !== 'string' || meta.name.length === 0) {
        throw new Error('meta.name must be a non-empty string');
    }

    let fontIdx;
    if (typeof meta.bank === 'number') {
        fontIdx = meta.bank;
    } else if (typeof meta.bank === 'string') {
        fontIdx = parseInt(meta.bank, 16);
    } else {
        throw new Error('meta.bank must be a number or a hex string');
    }
    if (!Number.isInteger(fontIdx) || fontIdx < 0 || fontIdx > 0xff) {
        throw new Error(`Invalid soundfont index in meta: ${JSON.stringify(meta.bank)}`);
    }

    const type = (meta.type == null || meta.type === '' ? 'bgm' : String(meta.type)).toLowerCase();

    return { name: meta.name, fontIdx, type };
}

/**
 * Builds a canonical .meta sidecar text from structured fields, matching the
 * three-line format ZeldaOTRizer::Sequence::FromSeqFile parses (name, hex font
 * index, type). Handy when you want to store or round-trip meta as text.
 * @param {{ name: string, bank: number|string, type?: string }} meta
 * @returns {string}
 */
export function buildMetaString(meta) {
    const { name, fontIdx, type } = normalizeMeta(meta);
    const fontHex = fontIdx.toString(16).toUpperCase();
    return `${name}\n${fontHex}\n${type}\n`;
}

/**
 * Builds the in-archive path the same way FromSeqFile does:
 * "custom/music/<name-with-/-replaced-by-|>_<type>" (no extension).
 */
export function buildArchivePath(meta) {
    const sanitizedName = meta.name.replace(/\//g, '|');
    return `custom/music/${sanitizedName}_${meta.type}`;
}

/**
 * Serializes one sequence into the exact byte layout SoH's resource loader
 * expects:
 *
 *   Header (0x40 bytes, OTRizer::Resource::WriteHeader):
 *     0x00  u8   endianness marker (0 = Little = Native on every real target)
 *     0x01  u8   0 (padding)
 *     0x02  u8   0 (padding)
 *     0x03  u8   0 (padding)
 *     0x04  u32  resource type      = 0x4F534551 ("AudioSequence")
 *     0x08  u32  game version       = 2 ("Rachael")
 *     0x0C  u64  id                 = 0xDEADBEEFDEADBEEF (unused placeholder)
 *     0x14  u32  resource version   = 0
 *     0x18  u64  ROM CRC            = 0 (unused for custom resources)
 *     0x20  u32  ROM enum           = 0 (unused for custom resources)
 *     0x24  ..   zero-padding out to 0x40
 *
 *   Resource data (ZeldaOTRizer::Sequence::WriteResourceData, immediately follows):
 *     0x40  u32  Size               = length of the raw .seq binary
 *     ...   u8[] RawBinary          = the raw .seq file bytes, verbatim
 *     ...   u8   SequenceNum        = 0 (ignored in-game for custom sequences)
 *     ...   u8   Medium             = 2 (MEDIUM_CART)
 *     ...   u8   CachePolicy        = 2 (CACHE_TEMPORARY) for bgm, 1 (CACHE_PERSISTENT) for fanfare
 *     ...   u32  NumFonts           = 1 (reference tool only ever emits one)
 *     ...   u8[] FontIndices        = NumFonts bytes, one per soundfont index
 */
export function buildSequenceResource(seqBytes, meta) {
    const cachePolicy = meta.type === 'bgm' ? 2 : 1;
    const medium = 2;
    const sequenceNum = 0;
    const numFonts = 1;

    const totalSize = HEADER_SIZE + 4 + seqBytes.length + 1 + 1 + 1 + 4 + numFonts;
    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    let offset = 0;

    // --- Header ---
    view.setUint8(offset, 0);
    offset += 1;
    view.setUint8(offset, 0);
    offset += 1;
    view.setUint8(offset, 0);
    offset += 1;
    view.setUint8(offset, 0);
    offset += 1;

    view.setUint32(offset, RESOURCE_TYPE_AUDIO_SEQUENCE, true);
    offset += 4;
    view.setUint32(offset, GAME_VERSION_RACHAEL, true);
    offset += 4;
    view.setBigUint64(offset, 0xdeadbeefdeadbeefn, true);
    offset += 8;
    view.setUint32(offset, RESOURCE_VERSION_AUDIO_SEQUENCE, true);
    offset += 4;
    view.setBigUint64(offset, 0n, true);
    offset += 8;
    view.setUint32(offset, 0, true);
    offset += 4;

    while (offset < HEADER_SIZE) {
        view.setUint32(offset, 0, true);
        offset += 4;
    }

    // --- Resource data ---
    view.setUint32(offset, seqBytes.length, true);
    offset += 4;
    bytes.set(seqBytes, offset);
    offset += seqBytes.length;
    view.setUint8(offset, sequenceNum);
    offset += 1;
    view.setUint8(offset, medium);
    offset += 1;
    view.setUint8(offset, cachePolicy);
    offset += 1;
    view.setUint32(offset, numFonts, true);
    offset += 4;
    view.setUint8(offset, meta.fontIdx);
    offset += 1;

    return bytes;
}
