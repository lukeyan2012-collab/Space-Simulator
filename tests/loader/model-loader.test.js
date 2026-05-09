import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Object3D } from 'three';
import { createModelLoader } from '@/loader/model-loader.js';

function makeFakeGLTFLoader(map) {
  // map: { url -> Object3D | 'fail' }
  return class {
    setPath() { return this; }
    load(url, onLoad, _onProgress, onError) {
      const v = map[url];
      if (v === 'fail' || v === undefined) onError(new Error('404 ' + url));
      else onLoad({ scene: v });
    }
  };
}

describe('model loader', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('uses the first hit in the fallback chain', async () => {
    const obj = new Object3D();
    const Fake = makeFakeGLTFLoader({ '/models/mercury_4k.glb': obj });
    const loader = createModelLoader({ basePath: '/models/', GLTFLoaderImpl: Fake });
    const res = await loader.load('mercury', 'high');
    expect(res).toBe(obj);
  });

  it('falls back to 1k then bare', async () => {
    const obj = new Object3D();
    const Fake = makeFakeGLTFLoader({ '/models/iss.glb': obj });
    const loader = createModelLoader({ basePath: '/models/', GLTFLoaderImpl: Fake });
    const res = await loader.load('iss', 'high');
    expect(res).toBe(obj);
  });

  it('caches misses so a second high-res request issues no fetches for missing files', async () => {
    const obj = new Object3D();
    let calls = 0;
    class Counted {
      setPath() { return this; }
      load(url, onLoad, _o, onError) {
        calls++;
        if (url === '/models/vesta_1k.glb') onLoad({ scene: obj });
        else onError(new Error('404'));
      }
    }
    const loader = createModelLoader({ basePath: '/models/', GLTFLoaderImpl: Counted });
    await loader.load('vesta', 'high'); // tries 4k (miss), 1k (hit)
    const before = calls;
    await loader.load('vesta', 'high'); // should NOT retry _4k
    expect(calls - before).toBe(0); // served from cache
  });

  it('returns null and records the miss when every fallback fails', async () => {
    class AllFail { setPath(){return this;} load(_u,_l,_p,e){ e(new Error('404')); } }
    const loader = createModelLoader({ basePath: '/models/', GLTFLoaderImpl: AllFail });
    const res = await loader.load('nope', 'high');
    expect(res).toBeNull();
  });
});
