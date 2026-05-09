// One-shot diagnostic: load 3D models/earth_1k.glb through the real GLTFLoader
// + our SpecGloss extension and dump the actual error if it fails.
// Run: node scripts/debug-glb-load.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// jsdom isn't loaded; provide just enough globals for GLTFLoader.parse() to function
// without trying to construct DOM canvases / images.
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
globalThis.document ??= { createElementNS: () => ({}), createElement: () => ({}) };

const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { registerSpecGlossExtension } = await import('../src/loader/specgloss-extension.js');

const file = resolve('3D models/earth_1k.glb');
const buf = readFileSync(file);
console.log('file:', file, 'bytes:', buf.byteLength);

const loader = new GLTFLoader();
registerSpecGlossExtension(loader);

const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

await new Promise((resolve, reject) => {
  loader.parse(
    arrayBuf,
    '',
    (gltf) => {
      console.log('PARSE OK');
      console.log('  scene name:', gltf.scene?.name);
      console.log('  child count:', gltf.scene?.children?.length);
      gltf.scene?.traverse((n) => {
        if (n.isMesh) {
          console.log('  mesh:', n.name, 'material type:', n.material?.constructor?.name, 'has map:', !!n.material?.map);
        }
      });
      resolve();
    },
    (err) => {
      console.error('PARSE FAILED:');
      console.error('  message:', err.message);
      console.error('  name:', err.name);
      console.error('  stack:', err.stack?.split('\n').slice(0, 8).join('\n'));
      reject(err);
    },
  );
}).catch(() => process.exit(1));
