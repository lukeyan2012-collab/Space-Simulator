import { describe, it, expect, vi } from 'vitest';
import { fetchWithProgress } from '@/loader/wasm-fetch.js';

function makeStreamingResponse(chunks, contentLength) {
  const reader = {
    i: 0,
    async read() {
      if (this.i >= chunks.length) return { done: true };
      return { done: false, value: chunks[this.i++] };
    },
  };
  return {
    ok: true,
    headers: { get: () => String(contentLength) },
    body: { getReader: () => reader },
  };
}

describe('fetchWithProgress', () => {
  it('reports incremental progress and returns concatenated bytes', async () => {
    const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), new Uint8Array([6])];
    const total = 6;
    global.fetch = vi.fn().mockResolvedValue(makeStreamingResponse(chunks, total));
    const reports = [];
    const buf = await fetchWithProgress('x', (p) => reports.push(p));
    const view = new Uint8Array(buf);
    expect(Array.from(view)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(reports.length).toBeGreaterThanOrEqual(3);
    expect(reports.at(-1)).toBe(1);
  });
});
