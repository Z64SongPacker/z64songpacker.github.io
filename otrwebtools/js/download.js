/**
 * Triggers a browser download of the given bytes as a file, via a
 * Blob + temporary object URL (no server involved).
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
export function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}
