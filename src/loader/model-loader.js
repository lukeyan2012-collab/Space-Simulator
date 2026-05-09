import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveCandidates } from './alias-map.js';
import { registerSpecGlossExtension } from './specgloss-extension.js';

// Per-module-load cache buster: prevents stale browser HTTP cache entries from being
// reused across page reloads (we hit a real bug where Vite served HTML for /models/* via
// the publicDir middleware, the browser cached that HTML, and even after fixing the server
// the cached HTML kept getting served as 304 Not Modified). Each fresh page load gets a
// unique value so the browser sees a URL it has no cache for.
const CACHE_BUSTER = (typeof Date !== 'undefined' ? Date.now() : Math.random()).toString(36);

export function createModelLoader({ basePath = '/models/', GLTFLoaderImpl = GLTFLoader, manager } = {}) {
  const loader = new GLTFLoaderImpl(manager);
  if (loader.setPath) loader.setPath(basePath);
  if (typeof loader.register === 'function') registerSpecGlossExtension(loader);
  /** @type {Map<string, Promise<import('three').Object3D|null>>} */
  const inflight = new Map();
  /** @type {Map<string, import('three').Object3D|null>} */
  const cache = new Map();
  /** @type {Set<string>} */
  const missCache = new Set();

  function key(name, lod) { return `${name.toLowerCase()}::${lod}`; }

  async function tryLoadOne(filename) {
    const url = basePath + filename;
    if (missCache.has(url)) return null;
    // NB: do NOT use `v=` as the param name — Vite intercepts that for its own module
    // versioning and rewrites the response as an ES-module wrapper. Use a neutral name.
    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'cb=' + CACHE_BUSTER;
    return await new Promise((resolve) => {
      loader.load(
        fetchUrl,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => {
          console.error('[model-loader] failed', url, '—', err?.message ?? err, err);
          missCache.add(url);
          resolve(null);
        },
      );
    });
  }

  async function load(name, lod /* 'high' | 'low' */) {
    const k = key(name, lod);
    if (cache.has(k)) return cache.get(k);
    if (inflight.has(k)) return inflight.get(k);

    const p = (async () => {
      const candidates = resolveCandidates(name, lod);
      for (const file of candidates) {
        const obj = await tryLoadOne(file);
        if (obj) { cache.set(k, obj); return obj; }
      }
      cache.set(k, null);
      return null;
    })();
    inflight.set(k, p);
    try { return await p; } finally { inflight.delete(k); }
  }

  function dispose(obj) {
    obj.traverse((node) => {
      if (node.geometry) node.geometry.dispose?.();
      const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
      for (const m of mats) {
        for (const k of Object.keys(m)) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose?.();
      }
    });
  }

  return { load, dispose, _internal: { cache, missCache } };
}
