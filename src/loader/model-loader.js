import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveCandidates } from './alias-map.js';
import { registerSpecGlossExtension } from './specgloss-extension.js';

// Per-module-load cache buster: prevents stale browser HTTP cache entries from being
// reused across page reloads (we hit a real bug where Vite served HTML for /models/* via
// the publicDir middleware, the browser cached that HTML, and even after fixing the server
// the cached HTML kept getting served as 304 Not Modified). Each fresh page load gets a
// unique value so the browser sees a URL it has no cache for.
const CACHE_BUSTER = (typeof Date !== 'undefined' ? Date.now() : Math.random()).toString(36);

export function createModelLoader({ basePath = '/models/', GLTFLoaderImpl = GLTFLoader, manager, onMiss = () => {} } = {}) {
  const loader = new GLTFLoaderImpl(manager);
  // NB: do NOT call loader.setPath(basePath). We pass full URLs (already starting with
  // basePath) into loader.load() ourselves, and three.js's resolveURL would re-prepend
  // setPath because the URL doesn't start with http:// or //, producing /models//models/foo.glb.
  if (typeof loader.register === 'function') registerSpecGlossExtension(loader);
  /** @type {Map<string, Promise<import('three').Object3D|null>>} */
  const inflight = new Map();
  /** @type {Map<string, import('three').Object3D|null>} */
  const cache = new Map();
  /** @type {Set<string>} */
  const missCache = new Set();

  function key(name, lod) { return `${name.toLowerCase()}::${lod}`; }

  // Quietly try one URL. Adds to missCache on failure but does NOT fire onMiss — the
  // load() caller decides whether the WHOLE chain failed and only then notifies the user.
  // Otherwise a body like ISS (which only exists as iss.glb, no _4k / _1k variants) would
  // produce two toasts for the suffixed attempts before iss.glb succeeds.
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
        () => {
          // Expected when a body has no _4k/_1k variant — keep the noise out of the console.
          missCache.add(url);
          resolve(null);
        },
      );
    });
  }

  // Per-assetName notification gate so we don't toast the same body twice across reloads
  // within a session.
  const notifiedMisses = new Set();

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
      // Whole chain missed — only NOW notify the user, and only once per asset.
      if (!notifiedMisses.has(name)) {
        notifiedMisses.add(name);
        console.warn('[model-loader] no GLB found for', name, '— tried:', candidates.join(', '));
        try { onMiss(`${name}.glb`); } catch {}
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
