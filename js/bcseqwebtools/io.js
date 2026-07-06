// Browser-only I/O helpers. Imported ONLY by UI code (index.html), never by the
// core, so src/ stays free of any host-environment assumptions.

/**
 * @param {ArrayBuffer} buf
 * @returns {Uint8Array}
 */
export function fromArrayBuffer(buf) {
  return new Uint8Array(buf);
}

/**
 * Wrap output bytes in a Blob for download.
 * @param {Uint8Array} bytes
 * @param {string} [type]
 * @returns {Blob}
 */
export function toBlob(bytes, type = 'application/octet-stream') {
  return new Blob([bytes], { type });
}

/**
 * Trigger a browser download of `bytes` as `filename`.
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
export function download(bytes, filename) {
  const url = URL.createObjectURL(toBlob(bytes));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
