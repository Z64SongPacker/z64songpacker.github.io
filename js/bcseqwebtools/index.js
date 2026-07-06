// Public entry point. Re-exports the pure, environment-agnostic core so a
// browser can `import { read, write } from './src/index.js'` with zero tooling.

export { read as readSseq } from './sseq/read.js';
export { write as writeSseq } from './sseq/write.js';

// 3DS/Wii-U BCSEQ (CSEQ container) — the primary target format.
export { read as readBcseq } from './bcseq/read.js';
export { write as writeBcseq } from './bcseq/write.js';

// N64 Audioseq -> IR -> BCSEQ pipeline (the end-to-end goal).
export { seqToBcseq } from './pipeline.js';
export { read as readN64Seq } from './n64/reader.js';
export { toIr as n64ToIr } from './n64/toIr.js';
export { BANKS, makeProgramRemap } from './n64/banks.js';
export { DRUM_KITS, BANK_DRUM_KITS, makeDrumKeyRemap, drumKitForBank } from './n64/drums.js';

export * as events from './ir/events.js';
export { Sequence } from './ir/events.js';

export { Reader } from './bytes/reader.js';
export { Writer } from './bytes/writer.js';
export { encodeVLQ, decodeVLQ, VLQ_MAX } from './bytes/vlq.js';

export { BY_NAME as SSEQ_COMMANDS_BY_NAME, BY_OPCODE as SSEQ_COMMANDS_BY_OPCODE } from './sseq/commands.js';
