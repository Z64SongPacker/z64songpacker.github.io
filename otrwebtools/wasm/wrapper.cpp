// WASM wrapper around StormLib, exposing just enough MPQ (.otr) archive
// creation/verification surface to be driven from JS. Mirrors the exact
// SFile* call sequence used by Ship::Archive::CreateArchive / Archive::AddFile
// in Kenix3/libultraship (commit 823d98f), so the produced archives match
// what SequenceOTRizer's reference tool would write.
#include <StormLib.h>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <emscripten.h>

namespace {
HANDLE g_writeArchive = nullptr;
HANDLE g_readArchive = nullptr;
} // namespace

extern "C" {

// Creates a new MPQ archive at `path` (a MEMFS path, e.g. "/output.otr").
// Flags/version match Ship::Archive::CreateArchive exactly.
EMSCRIPTEN_KEEPALIVE
int otr_create_archive(const char* path, uint32_t fileCapacity) {
    if (g_writeArchive) {
        SFileCloseArchive(g_writeArchive);
        g_writeArchive = nullptr;
    }
    // Clear out any stale file at this MEMFS path from a previous pack attempt.
    remove(path);

    DWORD flags = MPQ_CREATE_LISTFILE | MPQ_CREATE_ATTRIBUTES | MPQ_CREATE_ARCHIVE_V2;
    return SFileCreateArchive(path, flags, fileCapacity, &g_writeArchive) ? 1 : 0;
}

// Adds one file to the archive currently open for writing. `data`/`size` is
// the fully-serialized resource buffer (header + payload) built in JS.
// Compression flags match Ship::Archive::AddFile exactly (MPQ_FILE_COMPRESS
// at file-create time, MPQ_COMPRESSION_ZLIB at write time).
EMSCRIPTEN_KEEPALIVE
int otr_add_file(const char* archivedName, const uint8_t* data, uint32_t size) {
    if (!g_writeArchive) {
        return 0;
    }

    HANDLE hFile = nullptr;
    // Fixed (zero) file time instead of wall-clock time: the reference tool
    // stamps SFileCreateFile with the current system time, which makes its
    // own output non-deterministic across runs. We use a constant so that
    // packing the same inputs always produces byte-identical archives. This
    // field is MPQ container metadata (not read by the SoH resource loader),
    // so it does not affect whether the archive loads correctly in-game.
    const ULONGLONG kFixedFileTime = 0;

    if (!SFileCreateFile(g_writeArchive, archivedName, kFixedFileTime, size, 0, MPQ_FILE_COMPRESS, &hFile)) {
        return 0;
    }
    if (!SFileWriteFile(hFile, data, size, MPQ_COMPRESSION_ZLIB)) {
        SFileCloseFile(hFile);
        return 0;
    }
    if (!SFileFinishFile(hFile)) {
        return 0;
    }
    return 1;
}

// Finalizes and closes the archive currently open for writing. After this
// call, `path` on MEMFS holds the complete .otr file bytes.
EMSCRIPTEN_KEEPALIVE
int otr_close_archive(void) {
    if (!g_writeArchive) {
        return 0;
    }
    bool ok = SFileCloseArchive(g_writeArchive);
    g_writeArchive = nullptr;
    return ok ? 1 : 0;
}

// Reads an arbitrary MEMFS file fully into a malloc'd buffer. Used to pull
// the finished .otr bytes back out to JS for download.
EMSCRIPTEN_KEEPALIVE
uint8_t* otr_read_file_from_disk(const char* path, uint32_t* outSize) {
    *outSize = 0;
    FILE* f = fopen(path, "rb");
    if (!f) {
        return nullptr;
    }
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (size < 0) {
        fclose(f);
        return nullptr;
    }
    uint8_t* buf = static_cast<uint8_t*>(malloc(size > 0 ? static_cast<size_t>(size) : 1));
    size_t readCount = fread(buf, 1, static_cast<size_t>(size), f);
    fclose(f);
    *outSize = static_cast<uint32_t>(readCount);
    return buf;
}

EMSCRIPTEN_KEEPALIVE
void otr_free(void* ptr) {
    free(ptr);
}

// --- Round-trip verification: reopen the produced archive read-only and
// pull individual files back out, so JS can byte-compare them against what
// it asked to be written. ---

EMSCRIPTEN_KEEPALIVE
int otr_verify_open(const char* path) {
    if (g_readArchive) {
        SFileCloseArchive(g_readArchive);
        g_readArchive = nullptr;
    }
    return SFileOpenArchive(path, 0, MPQ_OPEN_READ_ONLY, &g_readArchive) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* otr_verify_read_file(const char* archivedName, uint32_t* outSize) {
    *outSize = 0;
    if (!g_readArchive) {
        return nullptr;
    }

    HANDLE hFile = nullptr;
    if (!SFileOpenFileEx(g_readArchive, archivedName, 0, &hFile)) {
        return nullptr;
    }

    DWORD size = SFileGetFileSize(hFile, nullptr);
    uint8_t* buf = static_cast<uint8_t*>(malloc(size > 0 ? size : 1));
    DWORD countRead = 0;
    if (!SFileReadFile(hFile, buf, size, &countRead, nullptr)) {
        SFileCloseFile(hFile);
        free(buf);
        return nullptr;
    }
    SFileCloseFile(hFile);
    *outSize = countRead;
    return buf;
}

EMSCRIPTEN_KEEPALIVE
void otr_verify_close(void) {
    if (g_readArchive) {
        SFileCloseArchive(g_readArchive);
        g_readArchive = nullptr;
    }
}

} // extern "C"
