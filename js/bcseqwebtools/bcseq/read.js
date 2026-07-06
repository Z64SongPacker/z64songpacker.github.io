// BCSEQ (3DS/Wii-U CSEQ) bytes -> IR.
//
// Container header is LITTLE-endian; sequence data inside the DATA block is
// BIG-endian (see commands.js). The command stream is decoded linearly from the
// start of the DATA payload; offset parameters (OpenTrack/Jump/Call) are
// relative to that start and become symbolic Labels. Non-DATA blocks (e.g. an
// empty LABL) are captured verbatim so the writer can reproduce them byte-exact.

import { Reader } from '../bytes/reader.js';
import { Sequence } from '../ir/events.js';
import {
  lookupOpcode, lookupExtSub, readParam,
  WRAP, EXTENDED_PREFIX,
} from './commands.js';

const DATA_BLOCK_ID = 0x5000;

/**
 * @param {Uint8Array} bytes
 * @returns {import('../ir/events.js').Sequence}
 */
export function read(bytes) {
  const r = new Reader(bytes);
  const magic = r.ascii(4);
  if (magic !== 'CSEQ') throw new Error('not a BCSEQ file (magic="' + magic + '")');

  const byteOrder = r.u16le();   // 0xFEFF
  const headerSize = r.u16le();  // 0x40
  const version = r.u32le();
  const fileSize = r.u32le();
  const blockCount = r.u32le();

  const blocks = [];
  for (let i = 0; i < blockCount; i++) {
    const id = r.u32le();
    const off = r.u32le();
    const size = r.u32le();
    blocks.push({ id, off, size });
  }

  const dataBlock = blocks.find((b) => b.id === DATA_BLOCK_ID);
  if (!dataBlock) throw new Error('BCSEQ has no DATA block (id 0x5000)');

  const streamStart = dataBlock.off + 8; // past 'DATA' + u32 size
  const streamEnd = Math.min(dataBlock.off + dataBlock.size, bytes.length);

  const seq = new Sequence();
  // Container metadata carried for byte-exact round-trip.
  seq.bcseq = {
    byteOrder,
    headerSize,
    version,
    alignment: 32,
    padByte: 0x00,
    padLength: 0,
    // Blocks in file order; DATA is regenerated, others kept verbatim.
    blocks: blocks.map((b) => ({
      id: b.id,
      verbatim: b.id === DATA_BLOCK_ID ? null : bytes.slice(b.off, b.off + b.size),
    })),
  };

  r.seek(streamStart);
  /** @type {{rel:number, event:object}[]} */
  const decoded = [];
  /** @type {Set<number>} */
  const targets = new Set();
  /** @type {{event:object, param:string}[]} */
  const offsetRefs = [];

  while (r.pos < streamEnd) {
    // Trailing all-zero alignment padding: a well-formed stream's last real
    // command is a Fin (0xFF), so any all-zero run to the block end is padding.
    if (allZero(bytes, r.pos, streamEnd)) {
      seq.bcseq.padLength = streamEnd - r.pos;
      break;
    }
    const rel = r.pos - streamStart;
    const event = decodeCommand(r);
    decoded.push({ rel, event });
    collectOffsets(event, targets, offsetRefs);
  }

  // Map each referenced relative position to the command that starts there.
  const byRel = new Map();
  for (const d of decoded) byRel.set(d.rel, d);
  const labelFor = new Map();
  for (const t of targets) {
    if (!byRel.has(t)) {
      throw new Error('offset target 0x' + t.toString(16) + ' is not a command boundary');
    }
    labelFor.set(t, 'L_' + t.toString(16).padStart(4, '0'));
  }
  for (const ref of offsetRefs) {
    ref.event.args[ref.param] = labelFor.get(ref.event.args[ref.param]);
  }

  for (const d of decoded) {
    if (labelFor.has(d.rel)) seq.events.push({ type: 'Label', name: labelFor.get(d.rel) });
    seq.events.push(d.event);
  }
  return seq;
}

/**
 * Record any offset parameters (on the event or a wrapped inner command) for
 * later label resolution.
 */
function collectOffsets(event, targets, offsetRefs) {
  if (event.type !== 'Command') return;
  const def = event._def;
  if (!def) return;
  for (const p of def.params) {
    if (p.kind === 'offset' && typeof event.args[p.name] === 'number') {
      targets.add(event.args[p.name]);
      offsetRefs.push({ event, param: p.name });
    }
  }
}

/**
 * Decode a single command (with optional wrapper prefix) at the cursor.
 * @param {Reader} r
 * @param {boolean} [noLastParam] drop the final parameter (Random/Variable inner)
 * @returns {object} an IR event
 */
function decodeCommand(r, noLastParam = false) {
  const first = r.u8();

  // Wrapper prefix?
  if (WRAP[first]) {
    const kind = WRAP[first];
    const innerNoLast = kind === 'random' || kind === 'variable';
    const inner = decodeCommand(r, innerNoLast);
    if (kind === 'random' || kind === 'timeRandom') {
      inner.wrapper = { kind, min: r.s16be(), max: r.s16be() };
    } else if (kind === 'variable' || kind === 'timeVariable') {
      inner.wrapper = { kind, variable: r.u8() };
    } else if (kind === 'time') {
      inner.wrapper = { kind, value: r.s16be() };
    } else {
      inner.wrapper = { kind }; // if
    }
    return inner;
  }

  // Note (status is the key).
  if (first < 0x80) {
    const key = first;
    const velocity = r.u8();
    const event = { type: 'Note', key, velocity };
    if (!noLastParam) event.duration = readParam(r, 'vl');
    return event;
  }

  // Extended (0xF0) command.
  let def;
  if (first === EXTENDED_PREFIX) {
    const sub = r.u8();
    def = lookupExtSub(sub);
    if (!def) throw new Error('unknown extended sub 0x' + sub.toString(16) + ' at ' + (r.pos - 1));
  } else {
    def = lookupOpcode(first);
    if (!def) throw new Error('unknown opcode 0x' + first.toString(16) + ' at ' + (r.pos - 1));
  }

  const args = {};
  const n = noLastParam ? def.params.length - 1 : def.params.length;
  for (let i = 0; i < n; i++) {
    const p = def.params[i];
    args[p.name] = readParam(r, p.kind);
  }
  const event = { type: 'Command', name: def.name, args };
  // Non-enumerable back-reference to the table entry (used for offset scan).
  Object.defineProperty(event, '_def', { value: def, enumerable: false });
  return event;
}

/** @param {Uint8Array} bytes @param {number} start @param {number} end */
function allZero(bytes, start, end) {
  for (let i = start; i < end; i++) if (bytes[i] !== 0) return false;
  return true;
}
