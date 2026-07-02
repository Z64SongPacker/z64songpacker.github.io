// Drives the StormLib-backed WASM module (src/wasm/wrapper.cpp) to build an
// in-memory .otr (MPQ) archive from sequence files, entirely in the browser.
import createOtrPackerModule from '../wasm/dist/otr_packer.js';
import { parseMeta, normalizeMeta, buildArchivePath, buildSequenceResource } from './resource.js';

// Matches Ship::Archive::CreateArchive(path, 40000) in the reference tool.
const MAX_FILE_CAPACITY = 40000;
const ARCHIVE_PATH = '/output.otr';

let modulePromise = null;
function loadModule() {
    if (!modulePromise) {
        modulePromise = createOtrPackerModule();
    }
    return modulePromise;
}

function writeBytesToHeap(Module, bytes) {
    const ptr = Module._malloc(bytes.length || 1);
    Module.HEAPU8.set(bytes, ptr);
    return ptr;
}

// Normalizes flexible seq input into a Uint8Array without copying when the
// caller already passed one.
function toUint8Array(data) {
    if (data instanceof Uint8Array) {
        return data;
    }
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if (Array.isArray(data)) {
        return Uint8Array.from(data);
    }
    throw new Error('seqData must be a Uint8Array, ArrayBuffer, typed array, or number[]');
}

// Resolves a file entry's meta from either a structured object (file.meta) or
// a raw .meta text string (file.metaData) into the { name, fontIdx, type } shape.
function resolveMeta(file) {
    if (file.meta != null && file.metaData != null) {
        throw new Error('provide either meta (object) or metaData (string), not both');
    }
    if (file.meta != null) {
        return normalizeMeta(file.meta);
    }
    if (typeof file.metaData === 'string') {
        return parseMeta(file.metaData);
    }
    throw new Error('missing meta: provide metaData (string) or meta ({ name, bank, type })');
}

function bytesEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * @typedef {Object} SequenceFile
 * @property {string} [name] - label for the sequence, used only in error
 *   messages (e.g. the original .seq filename). Optional.
 * @property {Uint8Array|ArrayBuffer|ArrayBufferView|number[]} seqData - the raw
 *   .seq bytes. All these forms are accepted and normalized to a Uint8Array.
 * @property {string} [metaData] - raw text of a .meta sidecar (name / hex font
 *   index / type, one per line). Provide this OR `meta`, not both.
 * @property {{ name: string, bank: number|string, type?: string }} [meta] -
 *   structured meta, as an alternative to a raw metaData string. `bank`
 *   may be a number (decimal 0-255) or a hex string; `type` defaults to "bgm".
 */

/**
 * Packs sequence files into an in-memory .otr archive. Works fully in memory:
 * no DOM, filesystem, or server access — pass seq bytes and meta directly.
 * @param {SequenceFile[]} files
 * @param {Object} [options]
 * @param {boolean} [options.verify=true] - re-open the produced archive with
 *   StormLib and byte-compare every entry against what was written.
 * @returns {Promise<Uint8Array>} the finished .otr archive bytes.
 */
export async function packOtr(files, options = {}) {
    const { verify = true } = options;
    const Module = await loadModule();

    const entries = files.map((file) => {
        const label = file.name ?? '(unnamed)';
        let meta;
        let seqBytes;
        try {
            meta = resolveMeta(file);
            seqBytes = toUint8Array(file.seqData);
        } catch (err) {
            throw new Error(`${label}: ${err.message}`);
        }
        const path = buildArchivePath(meta);
        const resourceBytes = buildSequenceResource(seqBytes, meta);
        return { name: label, path, resourceBytes };
    });

    const createArchive = Module.cwrap('otr_create_archive', 'number', ['string', 'number']);
    const addFile = Module.cwrap('otr_add_file', 'number', ['string', 'number', 'number']);
    const closeArchive = Module.cwrap('otr_close_archive', 'number', []);
    const readFileFromDisk = Module.cwrap('otr_read_file_from_disk', 'number', ['string', 'number']);
    const freePtr = Module.cwrap('otr_free', null, ['number']);

    if (!createArchive(ARCHIVE_PATH, MAX_FILE_CAPACITY)) {
        throw new Error('Failed to create .otr archive (SFileCreateArchive failed)');
    }

    for (const entry of entries) {
        const dataPtr = writeBytesToHeap(Module, entry.resourceBytes);
        try {
            if (!addFile(entry.path, dataPtr, entry.resourceBytes.length)) {
                throw new Error(`Failed to add "${entry.path}" (from ${entry.name}) to archive`);
            }
        } finally {
            freePtr(dataPtr);
        }
    }

    if (!closeArchive()) {
        throw new Error('Failed to finalize .otr archive (SFileCloseArchive failed)');
    }

    const outSizePtr = Module._malloc(4);
    let otrBytes;
    try {
        const dataPtr = readFileFromDisk(ARCHIVE_PATH, outSizePtr);
        if (!dataPtr) {
            throw new Error('Failed to read back finished .otr archive from MEMFS');
        }
        const size = Module.HEAPU32[outSizePtr >> 2];
        otrBytes = Module.HEAPU8.slice(dataPtr, dataPtr + size);
        freePtr(dataPtr);
    } finally {
        freePtr(outSizePtr);
    }

    if (verify) {
        await verifyRoundTrip(Module, entries);
    }

    return otrBytes;
}

/**
 * Reopens the just-produced archive read-only via StormLib and confirms
 * every entry is present and byte-identical to what was written. Throws on
 * any mismatch.
 */
async function verifyRoundTrip(Module, entries) {
    const verifyOpen = Module.cwrap('otr_verify_open', 'number', ['string']);
    const verifyRead = Module.cwrap('otr_verify_read_file', 'number', ['string', 'number']);
    const verifyClose = Module.cwrap('otr_verify_close', null, []);
    const freePtr = Module.cwrap('otr_free', null, ['number']);

    if (!verifyOpen(ARCHIVE_PATH)) {
        throw new Error('Round-trip verification failed: could not reopen produced archive');
    }

    try {
        for (const entry of entries) {
            const outSizePtr = Module._malloc(4);
            let dataPtr = 0;
            try {
                dataPtr = verifyRead(entry.path, outSizePtr);
                if (!dataPtr) {
                    throw new Error(`Round-trip verification failed: "${entry.path}" not found in produced archive`);
                }
                const size = Module.HEAPU32[outSizePtr >> 2];
                const readBack = Module.HEAPU8.slice(dataPtr, dataPtr + size);
                if (!bytesEqual(readBack, entry.resourceBytes)) {
                    throw new Error(`Round-trip verification failed: "${entry.path}" bytes do not match what was written`);
                }
            } finally {
                if (dataPtr) {
                    freePtr(dataPtr);
                }
                freePtr(outSizePtr);
            }
        }
    } finally {
        verifyClose();
    }
}
