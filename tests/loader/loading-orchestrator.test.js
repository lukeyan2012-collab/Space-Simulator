import { describe, it, expect, vi } from 'vitest';
import { createLoadingOrchestrator } from '@/loader/loading-orchestrator.js';

function fakeLoadingScreen() {
  return {
    progress: 0,
    errorMsg: null,
    setProgress(p) { this.progress = p; },
    showError(msg) { this.errorMsg = msg; },
  };
}

describe('loading orchestrator', () => {
  it('reports asset progress directly when no Wasm is being tracked', () => {
    const ls = fakeLoadingScreen();
    const orch = createLoadingOrchestrator(ls);
    orch.manager.onProgress('a.glb', 50, 100);
    expect(ls.progress).toBeCloseTo(0.5, 6);
    orch.manager.onLoad();
    expect(ls.progress).toBe(1);
  });

  it('weights wasm and assets 50/50 when wasm is tracked', async () => {
    const ls = fakeLoadingScreen();
    const orch = createLoadingOrchestrator(ls);
    let wasmReporter;
    const fakeFetch = Promise.resolve('ok');
    orch.trackWasm(fakeFetch, (cb) => { wasmReporter = cb; });
    wasmReporter(0.4);                              // 0.5 * 0.4 + 0.5 * 0 = 0.2
    expect(ls.progress).toBeCloseTo(0.2, 6);
    orch.manager.onProgress('a.glb', 50, 100);      // 0.5 * 0.4 + 0.5 * 0.5 = 0.45
    expect(ls.progress).toBeCloseTo(0.45, 6);
    wasmReporter(1.0);                              // 0.5 * 1 + 0.5 * 0.5 = 0.75
    expect(ls.progress).toBeCloseTo(0.75, 6);
  });

  it('shows error and rethrows when wasm fetch rejects', async () => {
    const ls = fakeLoadingScreen();
    const orch = createLoadingOrchestrator(ls);
    const failing = Promise.reject(new Error('boom'));
    await expect(orch.trackWasm(failing, () => {})).rejects.toThrow('boom');
    expect(ls.errorMsg).toBe('physics engine');
  });
});
