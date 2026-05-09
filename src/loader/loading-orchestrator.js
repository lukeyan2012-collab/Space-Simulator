import { LoadingManager } from 'three';

export function createLoadingOrchestrator(loadingScreen) {
  const manager = new LoadingManager();
  let assetFraction = 0;
  let wasmFraction = 1; // 1 if no wasm needed; updated below
  let useWasm = false;

  manager.onProgress = (_url, loaded, total) => { assetFraction = total ? loaded / total : 1; report(); };
  manager.onLoad = () => { assetFraction = 1; report(); };
  manager.onError = (url) => { console.error('asset failed', url); };

  function report() {
    const combined = useWasm ? 0.5 * wasmFraction + 0.5 * assetFraction : assetFraction;
    loadingScreen.setProgress(combined);
  }

  function trackWasm(fetchPromise, onProgressFn) {
    useWasm = true; wasmFraction = 0;
    onProgressFn((p) => { wasmFraction = p; report(); });
    return fetchPromise.catch((e) => { loadingScreen.showError('physics engine'); throw e; });
  }

  return { manager, trackWasm, report };
}
