# Space Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 60 fps interactive "God-mode" 3D Space Simulator (Three.js + JS-Verlet N-body) per `Space Simulator Masterplan.md` + §7 addendum.

**Architecture:** Vanilla JS + Vite + Vitest. Three.js for rendering, postprocessing for bloom + lensing. Custom Velocity-Verlet N-body engine in JS behind a swappable engine interface (so Wasm REBOUND can replace it later). Strict 4-stage delivery with `STOP AND WAIT` gates between stages.

**Tech Stack:** Three.js (>=0.160), three/examples/jsm (postprocessing, controls, loaders), Vite, Vitest + jsdom, vanilla DOM (no framework).

**Source documents (canonical):**
- `Space Simulator Masterplan.md` §1–6 (original brief)
- `Space Simulator Masterplan.md` §7 (clarifications addendum)

---

## File Structure

```
project root/
├── 3D models/                          (existing — DO NOT rename files)
├── docs/superpowers/plans/2026-05-08-space-simulator.md
├── index.html
├── package.json
├── vite.config.js
├── vitest.config.js
├── .gitignore
├── public/
│   └── models/                         (Vite-served alias to ../3D models)
├── src/
│   ├── main.js                         (entry: scene + loop wiring)
│   ├── physics/
│   │   ├── constants.js                (G, scales, time-base)
│   │   ├── engine-interface.js         (JSDoc contract — addBody/removeBody/step/getState/setState)
│   │   └── verlet-engine.js            (Velocity-Verlet implementation)
│   ├── loader/
│   │   ├── alias-map.js                (filename normalization + aliases)
│   │   ├── model-loader.js             (fallback chain, miss-cache, atomic swap, dispose)
│   │   └── wasm-fetch.js               (fetch with progress for future Wasm)
│   ├── lod/
│   │   ├── frustum-helper.js           (per-frame frustum cache)
│   │   └── lod-manager.js              (priority + hysteresis + budget=3)
│   ├── ui/
│   │   ├── loading-screen.js           (overlay + progress + error UI)
│   │   ├── time-slider.js              (0..1 strict slow-mo)
│   │   ├── sidebar.js                  (6 categories + search + drag start)
│   │   ├── properties-panel.js         (real-time REBOUND data)
│   │   ├── hover-card.js               (debounced anchored card)
│   │   ├── mass-slider.js              (per-selected mass + global visual size)
│   │   ├── reset-presets.js            (clear + presets dropdown)
│   │   └── toast.js                    (one-shot error toasts)
│   ├── interaction/
│   │   ├── camera-controls.js          (OrbitControls + double-click focus + ESC)
│   │   ├── raycaster.js                (click-to-select + hover)
│   │   └── drag-drop.js                (sidebar→canvas with ghost + orbital v)
│   ├── render/
│   │   ├── starfield.js                (procedural points)
│   │   ├── selective-bloom.js          (layer-based bloom composer)
│   │   └── lensing-pass.js             (black-hole screen-space lens)
│   ├── shaders/
│   │   ├── star-material.js            (temperature → emissive)
│   │   ├── nebula-material.js          (3D-noise volumetric, randomized)
│   │   └── black-hole-material.js      (event horizon + accretion disk)
│   ├── overlays/
│   │   ├── saturn-rings.js
│   │   └── earth-clouds.js
│   ├── data/
│   │   └── bodies.json                 (manifest — see Task 16)
│   └── persistence/
│       └── autosave.js                 (localStorage debounce + restore prompt)
└── tests/
    ├── physics/verlet-energy.test.js
    ├── physics/verlet-orbit.test.js
    ├── physics/engine-contract.test.js
    ├── loader/alias-map.test.js
    ├── loader/model-loader.test.js
    ├── loader/wasm-fetch.test.js
    ├── lod/lod-manager.test.js
    ├── lod/frustum-helper.test.js
    ├── ui/time-slider.test.js
    ├── ui/loading-screen.test.js
    ├── interaction/drag-drop.test.js
    ├── persistence/autosave.test.js
    └── shaders/material-smoke.test.js
```

**Files-that-change-together rule:** physics/, loader/, lod/, ui/, interaction/ each own one responsibility. Cross-cutting wiring lives only in `src/main.js`.

---

# Stage 1 — Scaffolding & Time

> **Gate:** at end of Stage 1 the app shows the loading screen, fades into a starfield with OrbitControls, the time slider (0..1) controls a Velocity-Verlet engine running a sample 2-body system, and pause holds physics while still rendering camera. Tests pass. **STOP AND WAIT.**

---

### Task 1: Project bootstrap (npm + Vite + Vitest)

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `.gitignore`, `index.html`, `src/main.js`, `public/models/.gitkeep`

- [ ] **Step 1: Initialize npm project**

Run from project root:

```bash
npm init -y
```

Expected: `package.json` created.

- [ ] **Step 2: Install runtime + dev deps**

```bash
npm install three
npm install -D vite vitest jsdom @vitest/ui
```

Expected: dependencies appear in `package.json`. No errors.

- [ ] **Step 3: Add scripts to package.json**

Edit `package.json` `"scripts"` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Also add at top level:

```json
"type": "module"
```

- [ ] **Step 4: Create vite.config.js**

```js
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      // allow Vite to serve files from the existing "3D models" folder
      allow: ['..', './3D models', '.'],
    },
  },
});
```

- [ ] **Step 5: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.vite/
.DS_Store
*.log
.env
.env.local
```

- [ ] **Step 7: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space Simulator</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="loading-screen"></div>
    <canvas id="scene"></canvas>
    <div id="ui-root"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 8: Create placeholder src/main.js**

```js
console.log('Space Simulator boot');
```

- [ ] **Step 9: Create public/models symlink (Windows: junction)**

Vite serves from `public/`. Existing `3D models/` is at the root — alias it under `public/models` so URLs are `/models/<file>.glb`. Use a Windows junction (no admin required):

```powershell
New-Item -ItemType Junction -Path "public/models" -Target "../3D models"
```

If junction creation fails (e.g., on cross-volume), fall back to copying:

```powershell
New-Item -ItemType Directory -Force -Path "public/models" | Out-Null
Copy-Item -Path "3D models/*" -Destination "public/models/" -Recurse -Force
```

Verify: `ls public/models/` should list the GLBs.

- [ ] **Step 10: Smoke test dev server boots**

```bash
npm run dev
```

Open `http://localhost:5173/`. Expected: console logs `Space Simulator boot`, no errors. Stop the server (Ctrl+C).

- [ ] **Step 11: Commit**

```bash
git init
git branch -M main
git add .
git commit -m "chore: scaffold vite + vitest + html shell"
```

---

### Task 2: Three.js scene, renderer, animation loop

**Files:**
- Create: `src/render/scene.js`, `src/styles.css`
- Modify: `src/main.js`

- [ ] **Step 1: Write failing test for scene factory**

Create `tests/render/scene.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createScene } from '@/render/scene.js';

describe('createScene', () => {
  it('returns a scene, perspective camera, and renderer with logarithmic depth', () => {
    const canvas = document.createElement('canvas');
    const { scene, camera, renderer } = createScene(canvas, { width: 800, height: 600 });
    expect(scene).toBeDefined();
    expect(camera.isPerspectiveCamera).toBe(true);
    expect(renderer.capabilities.logarithmicDepthBuffer).toBe(true);
    expect(renderer.domElement).toBe(canvas);
  });
});
```

Run: `npm run test -- tests/render/scene.test.js`. Expected: FAIL (module not found).

- [ ] **Step 2: Implement src/render/scene.js**

```js
import {
  Scene, PerspectiveCamera, WebGLRenderer, Color,
} from 'three';

export function createScene(canvas, { width, height }) {
  const scene = new Scene();
  scene.background = new Color(0x000005);

  const camera = new PerspectiveCamera(60, width / height, 0.1, 1e9);
  camera.position.set(0, 50, 200);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  return { scene, camera, renderer };
}
```

Run test. Expected: PASS.

- [ ] **Step 3: Wire into main.js**

Replace `src/main.js`:

```js
import { createScene } from '@/render/scene.js';

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, {
  width: window.innerWidth,
  height: window.innerHeight,
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
```

- [ ] **Step 4: Add base CSS**

Create `src/styles.css`:

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #000; color: #eee; font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
canvas#scene { position: fixed; inset: 0; display: block; }
#ui-root { position: fixed; inset: 0; pointer-events: none; }
#ui-root > * { pointer-events: auto; }
```

- [ ] **Step 5: Verify dev**

`npm run dev` → open browser → should see solid near-black canvas, no console errors. Resize the window — canvas resizes.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(render): scene + camera + renderer with logarithmic depth"
```

---

### Task 3: Procedural starfield

**Files:**
- Create: `src/render/starfield.js`, `tests/render/starfield.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write failing test**

`tests/render/starfield.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createStarfield } from '@/render/starfield.js';

describe('createStarfield', () => {
  it('returns a Points object with the requested star count', () => {
    const stars = createStarfield({ count: 5000, radius: 5000 });
    expect(stars.isPoints).toBe(true);
    expect(stars.geometry.attributes.position.count).toBe(5000);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement starfield**

`src/render/starfield.js`:

```js
import { BufferGeometry, BufferAttribute, Points, PointsMaterial } from 'three';

export function createStarfield({ count = 8000, radius = 8000 } = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // uniform on sphere via Marsaglia
    let u, v, s;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const factor = 2 * Math.sqrt(1 - s);
    const x = u * factor;
    const y = v * factor;
    const z = 1 - 2 * s;
    positions[i * 3 + 0] = x * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = z * radius;
  }
  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  const mat = new PointsMaterial({ size: 1.2, sizeAttenuation: false, color: 0xffffff });
  return new Points(geom, mat);
}
```

Run test. Expected: PASS.

- [ ] **Step 3: Add to scene**

In `src/main.js`, after `createScene`:

```js
import { createStarfield } from '@/render/starfield.js';
scene.add(createStarfield());
```

- [ ] **Step 4: Verify dev** — `npm run dev`, see stars on near-black background.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(render): procedural starfield"
```

---

### Task 4: OrbitControls + camera focus + ESC

**Files:**
- Create: `src/interaction/camera-controls.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write failing test (focus target API)**

`tests/interaction/camera-controls.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { Vector3, PerspectiveCamera } from 'three';
import { createCameraController } from '@/interaction/camera-controls.js';

describe('camera controller', () => {
  it('tweens target toward focus and stops when close', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.focus(new Vector3(100, 0, 0));
    // simulate ~1s @ 60fps
    for (let i = 0; i < 60; i++) ctl.update(1 / 60);
    expect(ctl.target.distanceTo(new Vector3(100, 0, 0))).toBeLessThan(1);
  });

  it('clearFocus resets target to origin', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.focus(new Vector3(50, 0, 0));
    ctl.clearFocus();
    for (let i = 0; i < 120; i++) ctl.update(1 / 60);
    expect(ctl.target.length()).toBeLessThan(1);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement camera controller**

`src/interaction/camera-controls.js`:

```js
import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const FOCUS_LERP = 6.0; // higher = snappier
const STOP_EPS = 0.05;

export function createCameraController(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1;
  controls.maxDistance = 5000;

  let focusTarget = null;
  const tmpDest = new Vector3();

  function focus(vec3) { focusTarget = vec3.clone(); }
  function clearFocus() { focusTarget = new Vector3(0, 0, 0); }

  function update(dt) {
    if (focusTarget) {
      tmpDest.copy(focusTarget);
      controls.target.lerp(tmpDest, Math.min(1, FOCUS_LERP * dt));
      if (controls.target.distanceTo(tmpDest) < STOP_EPS) controls.target.copy(tmpDest);
    }
    controls.update();
  }

  return { controls, focus, clearFocus, update, get target() { return controls.target; } };
}
```

Run test. Expected: PASS.

- [ ] **Step 3: Wire into main.js**

```js
import { createCameraController } from '@/interaction/camera-controls.js';
const cam = createCameraController(camera, renderer.domElement);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cam.clearFocus();
});
```

Modify the `tick` loop:

```js
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  cam.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 4: Verify dev** — drag rotates, scroll zooms, ESC re-centers.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(interaction): orbit controls + focus tween + ESC"
```

---

### Task 5: Loading screen overlay (no Wasm yet)

**Files:**
- Create: `src/ui/loading-screen.js`
- Modify: `index.html` (already has `#loading-screen`), `src/styles.css`, `src/main.js`

- [ ] **Step 1: Write failing test**

`tests/ui/loading-screen.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLoadingScreen } from '@/ui/loading-screen.js';

beforeEach(() => { document.body.innerHTML = '<div id="loading-screen"></div>'; });

describe('loading screen', () => {
  it('mounts a progress bar and updates width on setProgress', () => {
    const ls = createLoadingScreen();
    ls.setProgress(0.42);
    const bar = document.querySelector('#loading-screen .ls-bar-fill');
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBe('42%');
  });

  it('fadeOut resolves after CSS transition', async () => {
    vi.useFakeTimers();
    const ls = createLoadingScreen();
    const p = ls.fadeOut();
    vi.advanceTimersByTime(700);
    await p;
    expect(document.getElementById('loading-screen').classList.contains('ls-hidden')).toBe(true);
    vi.useRealTimers();
  });

  it('showError replaces the bar with an error message', () => {
    const ls = createLoadingScreen();
    ls.showError('boom');
    expect(document.querySelector('#loading-screen .ls-error').textContent).toContain('boom');
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement loading screen**

`src/ui/loading-screen.js`:

```js
export function createLoadingScreen() {
  const root = document.getElementById('loading-screen');
  root.innerHTML = `
    <div class="ls-inner">
      <div class="ls-title">Space Simulator</div>
      <div class="ls-bar"><div class="ls-bar-fill"></div></div>
      <div class="ls-status">Loading…</div>
    </div>`;
  const fill = root.querySelector('.ls-bar-fill');
  const status = root.querySelector('.ls-status');

  function setProgress(p) {
    const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
    fill.style.width = pct + '%';
    status.textContent = pct + '%';
  }

  function showError(msg) {
    root.querySelector('.ls-bar').remove();
    status.remove();
    const err = document.createElement('div');
    err.className = 'ls-error';
    err.textContent = `Failed to load: ${msg}. Reload to try again.`;
    root.querySelector('.ls-inner').appendChild(err);
  }

  function fadeOut() {
    root.classList.add('ls-fading');
    return new Promise((resolve) => setTimeout(() => {
      root.classList.add('ls-hidden');
      resolve();
    }, 600));
  }

  return { setProgress, showError, fadeOut };
}
```

- [ ] **Step 3: Add styles**

Append to `src/styles.css`:

```css
#loading-screen { position: fixed; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; z-index: 9999; transition: opacity 600ms ease; }
#loading-screen.ls-fading { opacity: 0; }
#loading-screen.ls-hidden { display: none; }
.ls-inner { width: min(420px, 80vw); text-align: center; }
.ls-title { font-size: 22px; letter-spacing: 0.2em; margin-bottom: 24px; opacity: 0.85; }
.ls-bar { height: 4px; background: #1a1a22; border-radius: 2px; overflow: hidden; }
.ls-bar-fill { height: 100%; width: 0; background: linear-gradient(90deg,#4af,#a4f); transition: width 200ms ease; }
.ls-status { margin-top: 12px; font-size: 12px; opacity: 0.6; letter-spacing: 0.1em; }
.ls-error { color: #f66; font-size: 13px; }
```

- [ ] **Step 4: Wire into main.js**

```js
import { createLoadingScreen } from '@/ui/loading-screen.js';
const loading = createLoadingScreen();
loading.setProgress(0);
// fake progress until we have real loaders
let p = 0;
const sim = setInterval(() => {
  p = Math.min(1, p + 0.05);
  loading.setProgress(p);
  if (p >= 1) { clearInterval(sim); loading.fadeOut(); }
}, 100);
```

Run tests. Expected: PASS.

- [ ] **Step 5: Verify dev** — see overlay fill 0→100% then fade away.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ui): loading screen with progress + fade + error UI"
```

---

### Task 6: Wasm fetch shim (with progress)

**Files:**
- Create: `src/loader/wasm-fetch.js`, `tests/loader/wasm-fetch.test.js`

- [ ] **Step 1: Write failing test**

`tests/loader/wasm-fetch.test.js`:

```js
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
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/loader/wasm-fetch.js`:

```js
export async function fetchWithProgress(url, onProgress = () => {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(received / total); else onProgress(0.5);
  }
  onProgress(1);
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out.buffer;
}
```

Run test. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(loader): wasm fetch shim with progress"
```

---

### Task 7: Physics constants + engine interface contract

**Files:**
- Create: `src/physics/constants.js`, `src/physics/engine-interface.js`, `tests/physics/engine-contract.test.js`

- [ ] **Step 1: Constants**

`src/physics/constants.js`:

```js
// SI units throughout the engine. Render layer applies DISTANCE_SCALE only.
export const G = 6.6743e-11;             // m^3 kg^-1 s^-2
export const SEC_PER_DAY = 86400;
export const M_SUN = 1.989e30;           // kg
export const SUPERNOVA_THRESHOLD_KG = 8 * M_SUN;

// Render scaling: 1 unit = 1e9 m (1 Gm). Sun radius ~0.7 units; 1 AU ~150 units.
export const DISTANCE_SCALE = 1 / 1e9;
// Visual size scaling default; applied per body (overridable).
export const SIZE_SCALE_DEFAULT = 0.0005; // tune in Stage 2 with manifest
// Time base: slider 1.0 = 1 sim-day per real second
export const TIME_BASE_SECONDS_PER_REAL_SECOND = SEC_PER_DAY;
// Sub-stepping
export const MAX_SUBSTEPS_PER_FRAME = 8;
// Gravitational softening to avoid singularities
export const SOFTENING_M = 1e3;
```

- [ ] **Step 2: Engine interface contract (JSDoc)**

`src/physics/engine-interface.js`:

```js
/**
 * @typedef {Object} BodyState
 * @property {string} id
 * @property {number} mass            kg
 * @property {[number,number,number]} position  meters
 * @property {[number,number,number]} velocity  m/s
 *
 * @typedef {Object} PhysicsEngine
 * @property {(spec: Omit<BodyState,'id'> & {id?:string}) => string} addBody
 * @property {(id: string) => void} removeBody
 * @property {(id: string) => BodyState | undefined} getState
 * @property {(id: string, partial: Partial<BodyState>) => void} setState
 * @property {(dt_seconds: number) => void} step
 * @property {() => BodyState[]} all
 * @property {() => void} clear
 */

export const ENGINE_INTERFACE_KEYS = [
  'addBody', 'removeBody', 'getState', 'setState', 'step', 'all', 'clear',
];
```

- [ ] **Step 3: Contract test (will be reused for any future engine)**

`tests/physics/engine-contract.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ENGINE_INTERFACE_KEYS } from '@/physics/engine-interface.js';
import { createVerletEngine } from '@/physics/verlet-engine.js';

describe('engine contract', () => {
  it('verlet engine implements the interface', () => {
    const e = createVerletEngine();
    for (const k of ENGINE_INTERFACE_KEYS) expect(typeof e[k]).toBe('function');
  });
});
```

Run. Expected: FAIL (verlet-engine missing). Fixed in Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/physics/constants.js src/physics/engine-interface.js tests/physics/engine-contract.test.js
git commit -m "feat(physics): SI constants + engine interface contract"
```

---

### Task 8: Velocity-Verlet engine

**Files:**
- Create: `src/physics/verlet-engine.js`, `tests/physics/verlet-orbit.test.js`, `tests/physics/verlet-energy.test.js`

- [ ] **Step 1: Write failing orbit test**

`tests/physics/verlet-orbit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import { G, SEC_PER_DAY } from '@/physics/constants.js';

// Earth around Sun: 1 AU, 30 km/s tangential. After 1 year position should be near origin.
describe('verlet engine — Earth-Sun two-body', () => {
  it('keeps Earth within 5% of 1 AU after 1 year', () => {
    const M_SUN = 1.989e30;
    const M_EARTH = 5.972e24;
    const AU = 1.496e11;
    const v = Math.sqrt(G * M_SUN / AU); // ~29.78 km/s
    const e = createVerletEngine();
    e.addBody({ id: 'sun',   mass: M_SUN,   position: [0,0,0],  velocity: [0,0,0] });
    e.addBody({ id: 'earth', mass: M_EARTH, position: [AU,0,0], velocity: [0,v,0] });

    const stepSec = 3600; // 1h
    const totalSec = 365.25 * SEC_PER_DAY;
    const N = Math.round(totalSec / stepSec);
    for (let i = 0; i < N; i++) e.step(stepSec);

    const pos = e.getState('earth').position;
    const r = Math.hypot(pos[0], pos[1], pos[2]);
    expect(Math.abs(r - AU) / AU).toBeLessThan(0.05);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Write failing energy test**

`tests/physics/verlet-energy.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import { G } from '@/physics/constants.js';

function totalEnergy(bodies) {
  let ke = 0, pe = 0;
  for (const b of bodies) {
    const v2 = b.velocity[0]**2 + b.velocity[1]**2 + b.velocity[2]**2;
    ke += 0.5 * b.mass * v2;
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[i].position[0] - bodies[j].position[0];
      const dy = bodies[i].position[1] - bodies[j].position[1];
      const dz = bodies[i].position[2] - bodies[j].position[2];
      const r = Math.sqrt(dx*dx + dy*dy + dz*dz);
      pe -= G * bodies[i].mass * bodies[j].mass / r;
    }
  }
  return ke + pe;
}

describe('verlet engine — energy drift', () => {
  it('conserves total energy within 1% over 100 days', () => {
    const M_SUN = 1.989e30;
    const M_EARTH = 5.972e24;
    const AU = 1.496e11;
    const v = Math.sqrt(G * M_SUN / AU);
    const e = createVerletEngine();
    e.addBody({ id: 'sun',   mass: M_SUN,   position: [0,0,0],  velocity: [0,0,0] });
    e.addBody({ id: 'earth', mass: M_EARTH, position: [AU,0,0], velocity: [0,v,0] });

    const E0 = totalEnergy(e.all());
    const stepSec = 3600;
    for (let i = 0; i < 24 * 100; i++) e.step(stepSec);
    const E1 = totalEnergy(e.all());
    expect(Math.abs((E1 - E0) / E0)).toBeLessThan(0.01);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 3: Implement Velocity-Verlet engine**

`src/physics/verlet-engine.js`:

```js
import { G, SOFTENING_M } from './constants.js';

let _id = 0;
const nextId = () => `b${++_id}`;

export function createVerletEngine() {
  /** @type {Map<string, {id:string,mass:number,position:Float64Array,velocity:Float64Array,acc:Float64Array,accPrev:Float64Array}>} */
  const bodies = new Map();
  let dirty = true;

  function addBody({ id = nextId(), mass, position, velocity }) {
    const b = {
      id,
      mass: +mass,
      position: Float64Array.from(position),
      velocity: Float64Array.from(velocity),
      acc:     new Float64Array(3),
      accPrev: new Float64Array(3),
    };
    bodies.set(id, b);
    dirty = true;
    return id;
  }

  function removeBody(id) { bodies.delete(id); dirty = true; }

  function getState(id) {
    const b = bodies.get(id); if (!b) return undefined;
    return { id, mass: b.mass, position: [b.position[0], b.position[1], b.position[2]], velocity: [b.velocity[0], b.velocity[1], b.velocity[2]] };
  }

  function setState(id, partial) {
    const b = bodies.get(id); if (!b) return;
    if (partial.mass != null) b.mass = +partial.mass;
    if (partial.position) { b.position[0] = partial.position[0]; b.position[1] = partial.position[1]; b.position[2] = partial.position[2]; }
    if (partial.velocity) { b.velocity[0] = partial.velocity[0]; b.velocity[1] = partial.velocity[1]; b.velocity[2] = partial.velocity[2]; }
    dirty = true;
  }

  function all() {
    const out = [];
    for (const b of bodies.values()) out.push(getState(b.id));
    return out;
  }

  function clear() { bodies.clear(); dirty = true; }

  function computeAccelerations() {
    const arr = [...bodies.values()];
    for (const b of arr) { b.acc[0] = 0; b.acc[1] = 0; b.acc[2] = 0; }
    const eps2 = SOFTENING_M * SOFTENING_M;
    for (let i = 0; i < arr.length; i++) {
      const bi = arr[i];
      for (let j = i + 1; j < arr.length; j++) {
        const bj = arr[j];
        const dx = bj.position[0] - bi.position[0];
        const dy = bj.position[1] - bi.position[1];
        const dz = bj.position[2] - bi.position[2];
        const r2 = dx*dx + dy*dy + dz*dz + eps2;
        const invR = 1 / Math.sqrt(r2);
        const invR3 = invR * invR * invR;
        const fij_overR = G * invR3;
        bi.acc[0] += fij_overR * bj.mass * dx;
        bi.acc[1] += fij_overR * bj.mass * dy;
        bi.acc[2] += fij_overR * bj.mass * dz;
        bj.acc[0] -= fij_overR * bi.mass * dx;
        bj.acc[1] -= fij_overR * bi.mass * dy;
        bj.acc[2] -= fij_overR * bi.mass * dz;
      }
    }
  }

  function step(dt) {
    if (dt <= 0 || bodies.size === 0) return;
    if (dirty) { computeAccelerations(); dirty = false; }
    // x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
    const halfDt2 = 0.5 * dt * dt;
    for (const b of bodies.values()) {
      b.accPrev[0] = b.acc[0]; b.accPrev[1] = b.acc[1]; b.accPrev[2] = b.acc[2];
      b.position[0] += b.velocity[0] * dt + b.accPrev[0] * halfDt2;
      b.position[1] += b.velocity[1] * dt + b.accPrev[1] * halfDt2;
      b.position[2] += b.velocity[2] * dt + b.accPrev[2] * halfDt2;
    }
    computeAccelerations();
    // v(t+dt) = v(t) + 0.5*(a(t)+a(t+dt))*dt
    const halfDt = 0.5 * dt;
    for (const b of bodies.values()) {
      b.velocity[0] += (b.accPrev[0] + b.acc[0]) * halfDt;
      b.velocity[1] += (b.accPrev[1] + b.acc[1]) * halfDt;
      b.velocity[2] += (b.accPrev[2] + b.acc[2]) * halfDt;
    }
  }

  return { addBody, removeBody, getState, setState, all, clear, step };
}
```

Run all physics tests. Expected: PASS (orbit, energy, contract).

- [ ] **Step 4: Commit**

```bash
git add src/physics/verlet-engine.js tests/physics/verlet-orbit.test.js tests/physics/verlet-energy.test.js
git commit -m "feat(physics): velocity-verlet n-body engine + orbit/energy tests"
```

---

### Task 9: Time slider UI (strict 0..1)

**Files:**
- Create: `src/ui/time-slider.js`, `tests/ui/time-slider.test.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing test**

`tests/ui/time-slider.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createTimeSlider } from '@/ui/time-slider.js';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('time slider', () => {
  it('clamps values to [0,1] strictly', () => {
    const ts = createTimeSlider({ initial: 1 });
    expect(ts.value).toBe(1);
    ts.set(2);  // attempted fast-forward — must clamp
    expect(ts.value).toBe(1);
    ts.set(-0.5);
    expect(ts.value).toBe(0);
  });

  it('fires onChange', () => {
    let last = null;
    const ts = createTimeSlider({ onChange: (v) => (last = v) });
    ts.set(0.25);
    expect(last).toBe(0.25);
  });

  it('paused at 0', () => {
    const ts = createTimeSlider();
    ts.set(0);
    expect(ts.isPaused).toBe(true);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/ui/time-slider.js`:

```js
export function createTimeSlider({ initial = 1, onChange = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'time-slider';
  root.innerHTML = `
    <label class="ts-label">Time <span class="ts-val">${initial.toFixed(2)}</span></label>
    <input type="range" min="0" max="1" step="0.001" value="${initial}" />
    <div class="ts-hint">0 = paused · 1 = 1 day/sec</div>`;
  const input = root.querySelector('input');
  const valEl = root.querySelector('.ts-val');
  document.getElementById('ui-root')?.appendChild(root);

  const state = { value: clamp(initial), isPaused: initial === 0 };

  function clamp(v) { return Math.min(1, Math.max(0, +v)); }

  function set(v) {
    state.value = clamp(v);
    state.isPaused = state.value === 0;
    input.value = String(state.value);
    valEl.textContent = state.value.toFixed(2);
    onChange(state.value);
  }

  input.addEventListener('input', (e) => set(+e.target.value));

  return {
    set,
    get value() { return state.value; },
    get isPaused() { return state.isPaused; },
  };
}
```

Run test. Expected: PASS.

- [ ] **Step 3: Add styles**

Append to `src/styles.css`:

```css
.time-slider { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: min(420px, 80vw); padding: 12px 16px; background: rgba(15,15,25,0.7); border: 1px solid #2a2a3a; border-radius: 8px; backdrop-filter: blur(6px); }
.time-slider .ts-label { display: flex; justify-content: space-between; font-size: 12px; letter-spacing: 0.1em; opacity: 0.85; margin-bottom: 6px; }
.time-slider input[type=range] { width: 100%; }
.time-slider .ts-hint { font-size: 10px; opacity: 0.5; margin-top: 4px; text-align: center; }
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(ui): strict 0..1 time slider with pause"
```

---

### Task 10: Wire engine + time slider into the loop, verify pause-but-render

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Update main.js to wire everything**

Replace `src/main.js` with:

```js
import { createScene } from '@/render/scene.js';
import { createStarfield } from '@/render/starfield.js';
import { createCameraController } from '@/interaction/camera-controls.js';
import { createLoadingScreen } from '@/ui/loading-screen.js';
import { createTimeSlider } from '@/ui/time-slider.js';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import {
  G, DISTANCE_SCALE, TIME_BASE_SECONDS_PER_REAL_SECOND, MAX_SUBSTEPS_PER_FRAME,
} from '@/physics/constants.js';
import { Mesh, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, PointLight } from 'three';

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, { width: innerWidth, height: innerHeight });
scene.add(createStarfield());
const cam = createCameraController(camera, renderer.domElement);

const loading = createLoadingScreen();
loading.setProgress(0);

// Sample 2-body system so Stage 1 is visibly working
const M_SUN = 1.989e30, M_EARTH = 5.972e24, AU = 1.496e11;
const engine = createVerletEngine();
engine.addBody({ id: 'sun',   mass: M_SUN,   position: [0,0,0],  velocity: [0,0,0] });
engine.addBody({ id: 'earth', mass: M_EARTH, position: [AU,0,0], velocity: [0, Math.sqrt(G*M_SUN/AU), 0] });

const sun = new Mesh(new SphereGeometry(0.7, 32, 32), new MeshBasicMaterial({ color: 0xffaa33 }));
const earth = new Mesh(new SphereGeometry(0.06, 24, 24), new MeshStandardMaterial({ color: 0x3377ff }));
scene.add(sun, earth);
scene.add(new PointLight(0xffffff, 2, 0, 2));

const slider = createTimeSlider({ initial: 0.5 });

function syncMesh(mesh, id) {
  const s = engine.getState(id); if (!s) return;
  mesh.position.set(s.position[0]*DISTANCE_SCALE, s.position[1]*DISTANCE_SCALE, s.position[2]*DISTANCE_SCALE);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cam.clearFocus(); });

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  cam.update(dt);

  if (!slider.isPaused) {
    const totalSimSec = slider.value * TIME_BASE_SECONDS_PER_REAL_SECOND * dt;
    const subSec = totalSimSec / MAX_SUBSTEPS_PER_FRAME;
    for (let i = 0; i < MAX_SUBSTEPS_PER_FRAME; i++) engine.step(subSec);
  }

  syncMesh(sun, 'sun');
  syncMesh(earth, 'earth');

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Stage 1 has no real assets to wait on — fade loading immediately after first frame.
requestAnimationFrame(() => {
  loading.setProgress(1);
  loading.fadeOut();
});
```

- [ ] **Step 2: Verify dev — golden path + pause behavior**

Run `npm run dev`. Open browser. Verify:
- Loading screen fades out
- Sun + tiny Earth visible; Earth orbits Sun (slider 0.5 → ~half day per real sec → orbit visible in ~12 minutes; **set slider to 1.0 for ~6 min orbit demo**)
- Drag-rotate / scroll-zoom works while orbiting
- **Set slider to 0**: Earth freezes mid-orbit. Camera still rotates. Confirm rendering continues by orbiting the camera.
- **Set slider back to 1.0**: Earth resumes from where it paused, no jump.

If Earth motion is hard to see, temporarily increase `TIME_BASE_SECONDS_PER_REAL_SECOND` in constants for visual demo, then revert.

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: wire verlet engine + time slider + pause-but-render"
```

---

### Stage 1 Acceptance & STOP-AND-WAIT

- [ ] All Stage 1 tests pass: `npm run test`
- [ ] Loading screen never hangs (manual: throttle network in DevTools — bar still completes after first render)
- [ ] Pause holds physics; camera/UI continue
- [ ] No console errors in dev
- [ ] Tag the stage:

```bash
git tag stage-1-scaffold
```

**STOP. Demo to user. Wait for explicit "go for Stage 2" before continuing.**

---

# Stage 2 — LOD & Loader

> **Gate:** Loader reads from `3D models/` with nested support, fallback chain, alias map for `ganymede`, persistent miss-cache, atomic LOD swap, full dispose. LOD manager keeps exactly 3 high-res, hysteresis at 150/200 units, frustum-based visibility. Loading screen reflects LoadingManager + Wasm-shim progress correctly. **STOP AND WAIT.**

---

### Task 11: Body manifest

**Files:**
- Create: `src/data/bodies.json`

- [ ] **Step 1: Write the manifest**

`src/data/bodies.json`:

```json
{
  "bodies": [
    { "id": "sun",         "displayName": "Sun",       "category": "Stars",                  "assetName": null,                              "procedural": "star",       "temperature_K": 5778,  "realMass_kg": 1.989e30,   "realRadius_m": 6.957e8,   "defaultColor": "#ffd27a", "description": "Our G-type main-sequence star, source of nearly all energy in the Solar System." },
    { "id": "sirius_a",    "displayName": "Sirius A",  "category": "Stars",                  "assetName": null,                              "procedural": "star",       "temperature_K": 9940,  "realMass_kg": 4.018e30,   "realRadius_m": 1.19e9,    "defaultColor": "#cfe1ff", "description": "Brightest star in Earth's night sky; an A-type main-sequence star." },
    { "id": "betelgeuse",  "displayName": "Betelgeuse","category": "Stars",                  "assetName": null,                              "procedural": "star",       "temperature_K": 3500,  "realMass_kg": 2.188e31,   "realRadius_m": 6.17e11,   "defaultColor": "#ff5c33", "description": "Red supergiant in Orion, expected to go supernova within 100k years." },
    { "id": "proxima",     "displayName": "Proxima Centauri","category":"Stars",             "assetName": null,                              "procedural": "star",       "temperature_K": 3042,  "realMass_kg": 2.428e29,   "realRadius_m": 1.072e8,   "defaultColor": "#ff7a4a", "description": "Closest star to the Sun; a low-mass red dwarf." },

    { "id": "mercury",     "displayName": "Mercury",   "category": "Planets",                "assetName": "mercury",                          "realMass_kg": 3.301e23,   "realRadius_m": 2.4397e6,  "defaultColor": "#a8a39a", "description": "Smallest planet; closest to the Sun." },
    { "id": "venus",       "displayName": "Venus",     "category": "Planets",                "assetName": "venus",                            "realMass_kg": 4.867e24,   "realRadius_m": 6.0518e6,  "defaultColor": "#e8c074", "description": "Hottest planet thanks to a runaway CO2 greenhouse." },
    { "id": "earth",       "displayName": "Earth",     "category": "Planets",                "assetName": "earth",      "overlay": "clouds",  "realMass_kg": 5.972e24,   "realRadius_m": 6.371e6,   "defaultColor": "#3377ff", "description": "Third planet; the only known cradle of life." },
    { "id": "mars",        "displayName": "Mars",      "category": "Planets",                "assetName": "mars",                             "realMass_kg": 6.417e23,   "realRadius_m": 3.3895e6,  "defaultColor": "#c1440e", "description": "The red planet; thin CO2 atmosphere, cold deserts, polar ice." },
    { "id": "jupiter",     "displayName": "Jupiter",   "category": "Planets",                "assetName": "jupiter",                          "realMass_kg": 1.898e27,   "realRadius_m": 6.9911e7,  "defaultColor": "#d9a86a", "description": "Largest planet; a gas giant with the Great Red Spot." },
    { "id": "saturn",      "displayName": "Saturn",    "category": "Planets",                "assetName": "saturn",     "overlay": "rings",   "realMass_kg": 5.683e26,   "realRadius_m": 5.8232e7,  "defaultColor": "#e3c98a", "description": "Famous ring system, 26.7° axial tilt." },
    { "id": "uranus",      "displayName": "Uranus",    "category": "Planets",                "assetName": "uranus",                           "realMass_kg": 8.681e25,   "realRadius_m": 2.5362e7,  "defaultColor": "#9fdfe6", "description": "Ice giant rotating on its side." },
    { "id": "neptune",     "displayName": "Neptune",   "category": "Planets",                "assetName": "neptune",                          "realMass_kg": 1.024e26,   "realRadius_m": 2.4622e7,  "defaultColor": "#3a6dd1", "description": "Outermost ice giant; supersonic winds." },

    { "id": "the_moon",    "displayName": "The Moon",  "category": "Moons",                  "assetName": "the_moon",                         "realMass_kg": 7.342e22,   "realRadius_m": 1.7374e6,  "defaultColor": "#bfbfbf", "description": "Earth's only natural satellite." },
    { "id": "phobos",      "displayName": "Phobos",    "category": "Moons",                  "assetName": "phobos",                           "realMass_kg": 1.0659e16,  "realRadius_m": 1.1267e4,  "defaultColor": "#7a6e5a", "description": "Larger of the two Martian moons." },
    { "id": "io",          "displayName": "Io",        "category": "Moons",                  "assetName": "io",                               "realMass_kg": 8.9319e22,  "realRadius_m": 1.8216e6,  "defaultColor": "#e8d35a", "description": "Most volcanically active body in the Solar System." },
    { "id": "europa",      "displayName": "Europa",    "category": "Moons",                  "assetName": "europa",                           "realMass_kg": 4.7998e22,  "realRadius_m": 1.5608e6,  "defaultColor": "#d3c2a0", "description": "Icy moon of Jupiter; subsurface ocean candidate." },
    { "id": "ganymede",    "displayName": "Ganymede",  "category": "Moons",                  "assetName": "ganymede",                         "realMass_kg": 1.4819e23,  "realRadius_m": 2.6341e6,  "defaultColor": "#9b8c70", "description": "Largest moon in the Solar System; bigger than Mercury." },
    { "id": "titan",       "displayName": "Titan",     "category": "Moons",                  "assetName": "titan",                            "realMass_kg": 1.3452e23,  "realRadius_m": 2.5747e6,  "defaultColor": "#d6a64f", "description": "Saturn's largest moon; thick nitrogen atmosphere, methane lakes." },
    { "id": "enceladus",   "displayName": "Enceladus", "category": "Moons",                  "assetName": "enceladus",                        "realMass_kg": 1.08e20,    "realRadius_m": 2.521e5,   "defaultColor": "#eaeaea", "description": "Icy moon of Saturn with cryovolcanic geysers." },
    { "id": "triton",      "displayName": "Triton",    "category": "Moons",                  "assetName": "triton",                           "realMass_kg": 2.139e22,   "realRadius_m": 1.3534e6,  "defaultColor": "#d8b6c6", "description": "Neptune's largest moon; retrograde orbit." },

    { "id": "vesta",       "displayName": "Vesta",     "category": "Asteroids",              "assetName": "vesta",                            "realMass_kg": 2.59e20,    "realRadius_m": 2.625e5,   "defaultColor": "#b0a597", "description": "Second-largest body in the asteroid belt." },
    { "id": "bennu",       "displayName": "Bennu",     "category": "Asteroids",              "assetName": "bennu",                            "realMass_kg": 7.329e10,   "realRadius_m": 2.45e2,    "defaultColor": "#5a5448", "description": "Near-Earth asteroid sampled by OSIRIS-REx." },

    { "id": "iss",         "displayName": "ISS",                       "category": "Satellites", "assetName": "iss",                          "realMass_kg": 4.5e5,      "realRadius_m": 5e1,       "defaultColor": "#cccccc", "description": "International Space Station, low Earth orbit." },
    { "id": "hubble",      "displayName": "Hubble Telescope",          "category": "Satellites", "assetName": "hubble_space_telescope",        "realMass_kg": 1.13e4,     "realRadius_m": 6.5,       "defaultColor": "#cccccc", "description": "Optical space telescope launched 1990." },
    { "id": "jwst",        "displayName": "James Webb Telescope",      "category": "Satellites", "assetName": "james_webb_space_telescope",    "realMass_kg": 6.16e3,     "realRadius_m": 21.0,      "defaultColor": "#ffd27a", "description": "Infrared space telescope at Sun-Earth L2." },
    { "id": "voyager_1",   "displayName": "Voyager 1",                 "category": "Satellites", "assetName": "voyager_1",                     "realMass_kg": 8.25e2,     "realRadius_m": 3.7,       "defaultColor": "#cccccc", "description": "Furthest human-made object from Earth." },
    { "id": "sputnik_1",   "displayName": "Sputnik 1",                 "category": "Satellites", "assetName": "sputnik_1",                     "realMass_kg": 8.36e1,     "realRadius_m": 0.58,      "defaultColor": "#cccccc", "description": "First artificial satellite; launched 1957." },

    { "id": "crab_nebula", "displayName": "Crab Nebula",  "category": "Star Remnants & Nebulae", "assetName": null, "procedural": "nebula",        "realMass_kg": 9.94e30, "realRadius_m": 5.21e16, "defaultColor": "#a64aff", "description": "Supernova remnant in Taurus, observed in 1054 CE." },
    { "id": "orion_nebula","displayName": "Orion Nebula", "category": "Star Remnants & Nebulae", "assetName": null, "procedural": "nebula",        "realMass_kg": 3.97e31, "realRadius_m": 1.18e17, "defaultColor": "#ff66aa", "description": "Diffuse nebula in Orion's sword; active star formation." },
    { "id": "ring_nebula", "displayName": "Ring Nebula",  "category": "Star Remnants & Nebulae", "assetName": null, "procedural": "nebula",        "realMass_kg": 4.0e29,  "realRadius_m": 4.7e15,  "defaultColor": "#66ffaa", "description": "Planetary nebula in Lyra." },
    { "id": "neutron_star","displayName": "Neutron Star", "category": "Star Remnants & Nebulae", "assetName": null, "procedural": "neutron_star",                             "realMass_kg": 2.78e30, "realRadius_m": 1e4,     "defaultColor": "#bff", "description": "Stellar remnant of an 8–25 M☉ progenitor." },
    { "id": "white_dwarf", "displayName": "White Dwarf",  "category": "Star Remnants & Nebulae", "assetName": null, "procedural": "white_dwarf",                              "realMass_kg": 1.19e30, "realRadius_m": 7e6,     "defaultColor": "#ffffff", "description": "Dense remnant of a low-to-medium mass star." },
    { "id": "bh_stellar",  "displayName": "Stellar Black Hole","category":"Star Remnants & Nebulae","assetName": null, "procedural": "black_hole",                            "realMass_kg": 1.989e31,"realRadius_m": 2.95e4,  "defaultColor": "#000000", "description": "Black hole formed from collapse of a massive star (~10 M☉)." },
    { "id": "bh_smbh",     "displayName": "Supermassive Black Hole","category":"Star Remnants & Nebulae","assetName": null, "procedural": "black_hole",                       "realMass_kg": 8.55e36,"realRadius_m": 1.27e10, "defaultColor": "#000000", "description": "Galactic-center black hole (~Sgr A* class, 4M M☉)." }
  ]
}
```

- [ ] **Step 2: Smoke-test the manifest loads**

Add `tests/data/manifest.test.js`:

```js
import { describe, it, expect } from 'vitest';
import manifest from '@/data/bodies.json';

describe('manifest', () => {
  it('has exactly the 6 categories from §4', () => {
    const cats = new Set(manifest.bodies.map(b => b.category));
    expect(cats).toEqual(new Set([
      'Planets','Moons','Stars','Star Remnants & Nebulae','Asteroids','Satellites',
    ]));
  });
  it('every entry has a unique id', () => {
    const ids = manifest.bodies.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('asset-backed entries have an assetName; procedural entries do not', () => {
    for (const b of manifest.bodies) {
      if (b.procedural) expect(b.assetName).toBeNull();
      else expect(typeof b.assetName).toBe('string');
    }
  });
});
```

Update `vite.config.js` to allow JSON imports in tests (already handled by Vite/Vitest by default).

Run. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/data/bodies.json tests/data/manifest.test.js
git commit -m "feat(data): body manifest with 6 categories"
```

---

### Task 12: Alias map + filename normalization

**Files:**
- Create: `src/loader/alias-map.js`, `tests/loader/alias-map.test.js`

- [ ] **Step 1: Write failing tests**

`tests/loader/alias-map.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveCandidates } from '@/loader/alias-map.js';

describe('resolveCandidates', () => {
  it('produces 4k → 1k → bare order for normal names', () => {
    expect(resolveCandidates('mercury', 'high')).toEqual(['mercury_4k.glb', 'mercury_1k.glb', 'mercury.glb']);
    expect(resolveCandidates('mercury', 'low')).toEqual(['mercury_1k.glb', 'mercury.glb']);
  });

  it('expands the ganymede alias to both spellings', () => {
    const out = resolveCandidates('ganymede', 'high');
    expect(out).toEqual([
      'ganymede_4k.glb','ganimedes_4k.glb','ganymade_4k.glb',
      'ganymede_1k.glb','ganimedes_1k.glb','ganymade_1k.glb',
      'ganymede.glb',   'ganimedes.glb',   'ganymade.glb',
    ]);
  });

  it('returns lowercase candidates so case-insensitive matching is possible downstream', () => {
    expect(resolveCandidates('IO', 'high')).toEqual(['io_4k.glb','io_1k.glb','io.glb']);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/loader/alias-map.js`:

```js
const ALIAS_MAP = {
  ganymede: ['ganymede', 'ganimedes', 'ganymade'],
};

export function resolveCandidates(name, lod /* 'high' | 'low' */) {
  const lc = String(name).toLowerCase();
  const stems = ALIAS_MAP[lc] ?? [lc];
  const suffixes = lod === 'high' ? ['_4k', '_1k', ''] : ['_1k', ''];
  const out = [];
  for (const sfx of suffixes) for (const stem of stems) out.push(`${stem}${sfx}.glb`);
  return out;
}
```

Run. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(loader): alias map + candidate resolution"
```

---

### Task 13: Model loader (fallback chain + miss cache + atomic swap + dispose)

**Files:**
- Create: `src/loader/model-loader.js`, `tests/loader/model-loader.test.js`

- [ ] **Step 1: Write failing tests**

`tests/loader/model-loader.test.js`:

```js
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
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement loader**

`src/loader/model-loader.js`:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveCandidates } from './alias-map.js';

export function createModelLoader({ basePath = '/models/', GLTFLoaderImpl = GLTFLoader, manager } = {}) {
  const loader = new GLTFLoaderImpl(manager);
  if (loader.setPath) loader.setPath(basePath);
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
    return await new Promise((resolve) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, () => { missCache.add(url); resolve(null); });
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
```

Run. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(loader): model loader with fallback chain, miss cache, dispose"
```

---

### Task 14: Frustum visibility helper

**Files:**
- Create: `src/lod/frustum-helper.js`, `tests/lod/frustum-helper.test.js`

- [ ] **Step 1: Write failing test**

`tests/lod/frustum-helper.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Sphere, Vector3 } from 'three';
import { createFrustumHelper } from '@/lod/frustum-helper.js';

describe('frustum helper', () => {
  it('returns true for a sphere at the camera target and false for one behind', () => {
    const cam = new PerspectiveCamera(60, 1, 0.1, 1000);
    cam.position.set(0,0,10); cam.lookAt(0,0,0); cam.updateMatrixWorld();
    const fh = createFrustumHelper();
    fh.update(cam);
    expect(fh.intersectsSphere(new Sphere(new Vector3(0,0,0), 1))).toBe(true);
    expect(fh.intersectsSphere(new Sphere(new Vector3(0,0,100), 1))).toBe(false);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lod/frustum-helper.js`:

```js
import { Frustum, Matrix4 } from 'three';

export function createFrustumHelper() {
  const frustum = new Frustum();
  const m = new Matrix4();
  function update(camera) {
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m);
  }
  function intersectsSphere(sphere) { return frustum.intersectsSphere(sphere); }
  return { update, intersectsSphere };
}
```

Run. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(lod): per-frame frustum helper"
```

---

### Task 15: LOD manager (priority + hysteresis + budget=3)

**Files:**
- Create: `src/lod/lod-manager.js`, `tests/lod/lod-manager.test.js`

- [ ] **Step 1: Write failing tests**

`tests/lod/lod-manager.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createLodManager } from '@/lod/lod-manager.js';

const HIGH_BUDGET = 3;

function bodies(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: 'b' + i,
    distance: 100 + i * 10,
    visible: true,
    selected: false,
    hovered: false,
  }));
}

describe('LOD manager', () => {
  it('promotes selected body even when far', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET });
    const list = bodies(5);
    list[4].distance = 9999; list[4].selected = true;
    const decisions = m.decide(list);
    expect(decisions.find(d => d.id === 'b4').lod).toBe('high');
  });

  it('honors priority order: selected, hovered, then closest visible', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET });
    const list = bodies(5);
    list[4].selected = true;          // far but selected
    list[3].hovered = true;           // far-ish but hovered
    list[0].distance = 50;            // closest visible
    list[1].distance = 60;            // next closest visible
    const decisions = m.decide(list);
    const high = decisions.filter(d => d.lod === 'high').map(d => d.id).sort();
    expect(high).toEqual(['b0','b3','b4']); // selected + hovered + 1 closest
  });

  it('hysteresis: a body at 175 stays in current state', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET, upgradeAt: 150, downgradeAt: 200 });
    const list = bodies(1); list[0].distance = 100;
    let d = m.decide(list); expect(d[0].lod).toBe('high');
    list[0].distance = 175;            // inside hysteresis band
    d = m.decide(list); expect(d[0].lod).toBe('high'); // sticky high
    list[0].distance = 250;
    d = m.decide(list); expect(d[0].lod).toBe('low');
    list[0].distance = 175;
    d = m.decide(list); expect(d[0].lod).toBe('low'); // sticky low
  });

  it('skips invisible bodies when filling closest-visible slots', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET });
    const list = bodies(5);
    list[0].visible = false; list[1].visible = false;
    const decisions = m.decide(list);
    const highIds = decisions.filter(d => d.lod === 'high').map(d => d.id);
    expect(highIds).toEqual(['b2','b3','b4']);
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lod/lod-manager.js`:

```js
const DEFAULT_OPTS = { highBudget: 3, upgradeAt: 150, downgradeAt: 200 };

export function createLodManager(opts = {}) {
  const { highBudget, upgradeAt, downgradeAt } = { ...DEFAULT_OPTS, ...opts };
  /** @type {Map<string, 'high'|'low'>} */
  const lastLod = new Map();

  function decide(list) {
    // Priority queue: selected → hovered → closest visible (by distance)
    const selected = list.filter(b => b.selected);
    const hovered  = list.filter(b => b.hovered && !b.selected);
    const others   = list.filter(b => !b.selected && !b.hovered && b.visible)
                          .sort((a, b) => a.distance - b.distance);

    const promoted = new Set();
    function promote(b) {
      if (promoted.size >= highBudget) return;
      promoted.add(b.id);
    }

    selected.forEach(promote);
    hovered.forEach(promote);
    for (const b of others) { if (promoted.size >= highBudget) break; promote(b); }

    const out = list.map(b => {
      const wantHigh = promoted.has(b.id) && (b.selected || b.hovered || b.distance < upgradeAt || lastLod.get(b.id) === 'high' && b.distance < downgradeAt);
      // Apply hysteresis on plain distance-driven decisions:
      let lod;
      if (b.selected || b.hovered) lod = 'high';
      else if (!promoted.has(b.id)) lod = 'low';
      else {
        const prev = lastLod.get(b.id);
        if (b.distance < upgradeAt) lod = 'high';
        else if (b.distance > downgradeAt) lod = 'low';
        else lod = prev ?? 'low';
      }
      lastLod.set(b.id, lod);
      return { id: b.id, lod };
    });
    return out;
  }

  return { decide, _internal: { lastLod } };
}
```

Run. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(lod): priority + hysteresis + budget manager"
```

---

### Task 16: Wire LoadingManager + Wasm shim into loading screen

**Files:**
- Create: `src/loader/loading-orchestrator.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write the orchestrator**

`src/loader/loading-orchestrator.js`:

```js
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
```

- [ ] **Step 2: Modify main.js to use the orchestrator**

In `src/main.js`, replace the loading-screen wiring block with:

```js
import { createLoadingOrchestrator } from '@/loader/loading-orchestrator.js';
import { createModelLoader } from '@/loader/model-loader.js';
const orch = createLoadingOrchestrator(loading);
const modelLoader = createModelLoader({ basePath: '/models/', manager: orch.manager });
```

For Stage 2 sanity, replace the placeholder Earth mesh with a real Earth GLB:

```js
const earthGltf = await modelLoader.load('earth', 'low');
if (earthGltf) {
  earth.geometry.dispose(); earth.material.dispose();
  scene.remove(earth);
  const realEarth = earthGltf.clone();
  realEarth.scale.setScalar(0.06); // tune later
  scene.add(realEarth);
  // make syncMesh point at this object instead
}
```

(Wrap the boot in an `async function main(){…}` and call it.)

- [ ] **Step 3: Manual smoke test**

Run dev. Confirm: loading screen shows actual asset progress as Earth GLB downloads, then fades.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(loader): orchestrator unifies LoadingManager + wasm progress"
```

---

### Task 17: LOD wiring with all manifest bodies

**Files:**
- Create: `src/lod/body-record.js`, `src/lod/lod-runtime.js`
- Modify: `src/main.js`

- [ ] **Step 1: Build body-record helper**

`src/lod/body-record.js`:

```js
import { Mesh, SphereGeometry, MeshStandardMaterial, Color, Sphere, Vector3 } from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

export function makePlaceholder(body) {
  const g = new SphereGeometry(1, 16, 16);
  const m = new MeshStandardMaterial({ color: new Color(body.defaultColor) });
  return new Mesh(g, m);
}

export function createBodyRecord(body, mesh, sceneScale) {
  return {
    id: body.id,
    body,
    object: mesh,
    currentLod: 'low',
    selected: false,
    hovered: false,
    sceneScale,
    boundingSphere: new Sphere(new Vector3(), 1),
    syncFromEngine(engineState, camera) {
      const p = engineState.position;
      mesh.position.set(p[0]*DISTANCE_SCALE, p[1]*DISTANCE_SCALE, p[2]*DISTANCE_SCALE);
      this.boundingSphere.center.copy(mesh.position);
      this.boundingSphere.radius = sceneScale; // tune to actual model size when known
      this._distance = mesh.position.distanceTo(camera.position);
    },
  };
}
```

- [ ] **Step 2: LOD runtime: per-frame swap**

`src/lod/lod-runtime.js`:

```js
import { createLodManager } from './lod-manager.js';
import { createFrustumHelper } from './frustum-helper.js';

export function createLodRuntime({ records, modelLoader, scene }) {
  const manager = createLodManager();
  const frustum = createFrustumHelper();

  async function setLod(rec, target) {
    if (rec.currentLod === target) return;
    if (rec.body.procedural) { rec.currentLod = target; return; }
    const obj = await modelLoader.load(rec.body.assetName, target);
    if (!obj) return; // miss-cache will keep us on placeholder
    const newMesh = obj.clone(true);
    newMesh.position.copy(rec.object.position);
    newMesh.scale.copy(rec.object.scale);
    scene.add(newMesh);
    scene.remove(rec.object);
    modelLoader.dispose(rec.object); // safe — placeholder or previous LOD
    rec.object = newMesh;
    rec.currentLod = target;
  }

  function tick(camera) {
    frustum.update(camera);
    const list = records.map(r => ({
      id: r.id,
      distance: r._distance ?? Infinity,
      visible: frustum.intersectsSphere(r.boundingSphere),
      selected: r.selected,
      hovered: r.hovered,
    }));
    const decisions = manager.decide(list);
    for (const d of decisions) {
      const r = records.find(rr => rr.id === d.id);
      if (r) setLod(r, d.lod);
    }
  }

  return { tick };
}
```

- [ ] **Step 3: Wire into main.js**

Replace the hard-coded Sun/Earth block with: load the manifest, create a body record per entry, instantiate placeholders, add to engine + scene, and run the LOD runtime each frame.

```js
import manifest from '@/data/bodies.json';
import { createBodyRecord, makePlaceholder } from '@/lod/body-record.js';
import { createLodRuntime } from '@/lod/lod-runtime.js';

// Build records (initially placeholder spheres, all at origin until presets/drag adds them)
const records = [];
function spawnFromManifest(spec, position = [0,0,0], velocity = [0,0,0]) {
  const placeholder = makePlaceholder(spec);
  const renderRadius = Math.max(0.05, Math.log10(spec.realRadius_m) * 0.05); // visual scale
  placeholder.scale.setScalar(renderRadius);
  scene.add(placeholder);
  engine.addBody({ id: spec.id, mass: spec.realMass_kg, position, velocity });
  const rec = createBodyRecord(spec, placeholder, renderRadius);
  records.push(rec);
  return rec;
}

// Stage 2 demo: spawn Sun at origin, Earth at 1 AU
const sunSpec = manifest.bodies.find(b => b.id === 'sun');
const earthSpec = manifest.bodies.find(b => b.id === 'earth');
const AU = 1.496e11; const v = Math.sqrt(G * sunSpec.realMass_kg / AU);
spawnFromManifest(sunSpec, [0,0,0], [0,0,0]);
spawnFromManifest(earthSpec, [AU,0,0], [0, v, 0]);

const lodRuntime = createLodRuntime({ records, modelLoader, scene });
```

In the `tick`, after physics step:

```js
for (const rec of records) {
  const s = engine.getState(rec.id); if (!s) continue;
  rec.syncFromEngine(s, camera);
}
lodRuntime.tick(camera);
```

- [ ] **Step 4: Manual verify**

`npm run dev`. Earth (placeholder) replaced by real Earth GLB when zoomed within 150 units. Zoom out past 200 — degrades to low-res. Quick wiggle around 175 should NOT flicker.

- [ ] **Step 5: Run all tests**

```bash
npm run test
```

All PASS.

- [ ] **Step 6: Commit + tag stage**

```bash
git add .
git commit -m "feat(lod): wire manifest + LOD runtime into main loop"
git tag stage-2-lod
```

**STOP. Demo to user. Wait for explicit "go for Stage 3" before continuing.**

---

# Stage 3 — UI & Raycasting

> **Gate:** Sidebar with 6 categories + search; drag-and-drop spawn with ghost preview + auto-orbital velocity; click-to-select + properties panel; hover card with debounce; mass slider w/ supernova; reset + presets + autosave; touch fallback; toast errors; ESC handling. **STOP AND WAIT.**

---

### Task 18: Sidebar (categories + search + drag start)

**Files:**
- Create: `src/ui/sidebar.js`, `tests/ui/sidebar.test.js`

- [ ] **Step 1: Write failing test**

`tests/ui/sidebar.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createSidebar } from '@/ui/sidebar.js';
import manifest from '@/data/bodies.json';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('sidebar', () => {
  it('renders one section per category', () => {
    createSidebar({ manifest });
    const heads = document.querySelectorAll('.sb-category');
    expect(heads.length).toBe(6);
  });
  it('search filters across all categories', () => {
    createSidebar({ manifest });
    const input = document.querySelector('.sb-search');
    input.value = 'titan'; input.dispatchEvent(new Event('input'));
    const visible = [...document.querySelectorAll('.sb-item')].filter(el => !el.classList.contains('sb-hidden'));
    expect(visible.length).toBe(1);
    expect(visible[0].textContent.toLowerCase()).toContain('titan');
  });
  it('emits onDragStart with body id', () => {
    let payload = null;
    createSidebar({ manifest, onDragStart: (id) => (payload = id) });
    const item = document.querySelector('[data-body-id="earth"]');
    item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    expect(payload).toBe('earth');
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/ui/sidebar.js`:

```js
const CATEGORIES = ['Planets','Moons','Stars','Star Remnants & Nebulae','Asteroids','Satellites'];

export function createSidebar({ manifest, onDragStart = () => {}, onTapAdd = () => {} }) {
  const root = document.createElement('aside');
  root.className = 'sidebar';
  root.innerHTML = `
    <header><h2>Bodies</h2><button class="sb-toggle" aria-label="Collapse">‹</button></header>
    <input class="sb-search" type="search" placeholder="Search…" />
    <div class="sb-list"></div>`;
  document.getElementById('ui-root').appendChild(root);
  const list = root.querySelector('.sb-list');

  for (const cat of CATEGORIES) {
    const section = document.createElement('section');
    section.className = 'sb-category';
    section.innerHTML = `<h3>${cat}</h3><ul></ul>`;
    const ul = section.querySelector('ul');
    for (const b of manifest.bodies.filter(x => x.category === cat)) {
      const li = document.createElement('li');
      li.className = 'sb-item';
      li.dataset.bodyId = b.id;
      li.draggable = true;
      li.innerHTML = `<span class="sb-dot" style="background:${b.defaultColor}"></span>${b.displayName}`;
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', b.id);
        onDragStart(b.id);
      });
      li.addEventListener('click', () => onTapAdd(b.id));
      ul.appendChild(li);
    }
    list.appendChild(section);
  }

  const search = root.querySelector('.sb-search');
  search.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const item of root.querySelectorAll('.sb-item')) {
      const hit = !q || item.textContent.toLowerCase().includes(q);
      item.classList.toggle('sb-hidden', !hit);
    }
    for (const sec of root.querySelectorAll('.sb-category')) {
      const anyVisible = sec.querySelector('.sb-item:not(.sb-hidden)');
      sec.style.display = anyVisible ? '' : 'none';
    }
  });

  root.querySelector('.sb-toggle').addEventListener('click', () => root.classList.toggle('sb-collapsed'));

  return { root };
}
```

Append to `src/styles.css`:

```css
.sidebar { position: fixed; top: 16px; left: 16px; width: 260px; max-height: calc(100vh - 32px); overflow-y: auto; background: rgba(15,15,25,0.78); border: 1px solid #2a2a3a; border-radius: 8px; padding: 12px; backdrop-filter: blur(6px); font-size: 13px; }
.sidebar.sb-collapsed { width: 40px; overflow: hidden; }
.sidebar header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sidebar h2 { margin: 0; font-size: 14px; letter-spacing: 0.1em; }
.sidebar .sb-toggle { background: transparent; border: 0; color: #aaa; cursor: pointer; font-size: 18px; }
.sb-search { width: 100%; padding: 6px 8px; margin-bottom: 8px; background: #0a0a12; color: #ddd; border: 1px solid #2a2a3a; border-radius: 4px; }
.sb-category h3 { margin: 8px 0 4px; font-size: 11px; opacity: 0.6; letter-spacing: 0.1em; text-transform: uppercase; }
.sb-category ul { list-style: none; padding: 0; margin: 0; }
.sb-item { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 4px; cursor: grab; user-select: none; }
.sb-item:hover { background: #1a1a28; }
.sb-item.sb-hidden { display: none; }
.sb-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
```

Run tests. PASS.

- [ ] **Step 3: Wire into main.js**

```js
import { createSidebar } from '@/ui/sidebar.js';
const sidebar = createSidebar({ manifest, onDragStart: (id) => dragDrop.beginDragFromSidebar(id), onTapAdd: (id) => dragDrop.armForTapAdd(id) });
```

(`dragDrop` will be defined in Task 21.)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(ui): collapsible sidebar with categories + search"
```

---

### Task 19: Properties panel + click-to-select raycaster

**Files:**
- Create: `src/ui/properties-panel.js`, `src/interaction/raycaster.js`
- Modify: `src/main.js`

- [ ] **Step 1: Properties panel test**

`tests/ui/properties-panel.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createPropertiesPanel } from '@/ui/properties-panel.js';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('properties panel', () => {
  it('shows nothing when no selection', () => {
    const p = createPropertiesPanel();
    expect(document.querySelector('.props-empty')).toBeTruthy();
  });
  it('renders body data on update', () => {
    const p = createPropertiesPanel();
    p.update({
      body: { displayName: 'Earth', realMass_kg: 5.972e24, description: 'Home' },
      state: { mass: 5.972e24, position: [1,2,3], velocity: [0,30000,0] },
      lod: 'high',
    });
    expect(document.querySelector('.props-name').textContent).toContain('Earth');
    expect(document.querySelector('.props-lod').textContent).toContain('high');
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement properties panel**

`src/ui/properties-panel.js`:

```js
function fmt(n) { return Math.abs(n) >= 1e4 || Math.abs(n) < 1e-2 ? n.toExponential(3) : n.toFixed(3); }

export function createPropertiesPanel() {
  const root = document.createElement('aside');
  root.className = 'props-panel';
  root.innerHTML = `<div class="props-empty">Click an object to inspect</div>`;
  document.getElementById('ui-root').appendChild(root);

  function update(view) {
    if (!view) { root.innerHTML = `<div class="props-empty">Click an object to inspect</div>`; return; }
    const { body, state, lod } = view;
    const v = state.velocity;
    root.innerHTML = `
      <h3 class="props-name">${body.displayName}</h3>
      <p class="props-desc">${body.description ?? ''}</p>
      <dl>
        <dt>Mass</dt><dd>${fmt(state.mass)} kg</dd>
        <dt>Velocity</dt><dd>(${fmt(v[0])}, ${fmt(v[1])}, ${fmt(v[2])}) m/s</dd>
        <dt>Speed</dt><dd>${fmt(Math.hypot(v[0],v[1],v[2]))} m/s</dd>
        <dt class="props-lod-label">LOD</dt><dd class="props-lod">${lod}</dd>
      </dl>`;
  }
  return { update };
}
```

Append CSS:

```css
.props-panel { position: fixed; top: 16px; right: 16px; width: 280px; background: rgba(15,15,25,0.78); border: 1px solid #2a2a3a; border-radius: 8px; padding: 12px; font-size: 12px; backdrop-filter: blur(6px); }
.props-panel h3 { margin: 0 0 4px; font-size: 14px; }
.props-panel .props-desc { opacity: 0.7; margin: 0 0 8px; font-size: 11px; }
.props-panel dl { display: grid; grid-template-columns: 80px 1fr; gap: 4px 12px; margin: 0; }
.props-panel dt { opacity: 0.6; }
.props-panel dd { margin: 0; word-break: break-all; }
.props-empty { opacity: 0.5; font-size: 12px; text-align: center; padding: 20px 0; }
```

Run test. PASS.

- [ ] **Step 3: Raycaster module**

`src/interaction/raycaster.js`:

```js
import { Raycaster, Vector2 } from 'three';

export function createSelectionRaycaster({ camera, domElement, getRecords, onSelect, onHover }) {
  const ray = new Raycaster();
  const mouse = new Vector2();
  let lastHovered = null;

  function ndcFromEvent(e, out) {
    const r = domElement.getBoundingClientRect();
    out.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    out.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pick(e) {
    ndcFromEvent(e, mouse);
    ray.setFromCamera(mouse, camera);
    const objects = getRecords().map(r => r.object);
    const hits = ray.intersectObjects(objects, true);
    if (!hits.length) return null;
    // climb to the root that we own
    let n = hits[0].object;
    while (n.parent && !getRecords().some(r => r.object === n)) n = n.parent;
    return getRecords().find(r => r.object === n) ?? null;
  }

  domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const rec = pick(e);
    if (rec) onSelect(rec);
    else onSelect(null);
  });

  domElement.addEventListener('pointermove', (e) => {
    const rec = pick(e);
    if (rec !== lastHovered) { onHover(rec, lastHovered); lastHovered = rec; }
  });

  return {};
}
```

- [ ] **Step 4: Wire selection in main.js**

```js
import { createPropertiesPanel } from '@/ui/properties-panel.js';
import { createSelectionRaycaster } from '@/interaction/raycaster.js';
const props = createPropertiesPanel();
let selected = null;
createSelectionRaycaster({
  camera, domElement: renderer.domElement,
  getRecords: () => records,
  onSelect: (rec) => {
    if (selected) selected.selected = false;
    selected = rec;
    if (selected) selected.selected = true;
    props.update(null);
  },
  onHover: (rec, prev) => {
    if (prev) prev.hovered = false;
    if (rec) rec.hovered = true;
  },
});
// click empty space inside canvas already deselects via onSelect(null).
// click on UI panels: they sit on top with their own pointer events; we must NOT deselect.
// Add stopPropagation in the panel root creators so canvas pointerdown doesn't fire.
```

In `tick`, refresh props panel each frame for the selected body:

```js
if (selected) {
  const s = engine.getState(selected.id);
  props.update({ body: selected.body, state: s, lod: selected.currentLod });
}
```

In `props-panel.js` and `sidebar.js` constructors, add:

```js
root.addEventListener('pointerdown', (e) => e.stopPropagation());
```

ESC handler (extend the existing keydown):

```js
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cam.clearFocus();
    if (selected) { selected.selected = false; selected = null; props.update(null); }
  }
});
```

- [ ] **Step 5: Manual verify** — click a body: panel updates real-time. Click empty space: deselect. ESC: clears focus + selection. Click sidebar: does NOT deselect.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ui): properties panel + click-to-select raycaster + ESC rules"
```

---

### Task 20: Hover card (debounced, anchored)

**Files:**
- Create: `src/ui/hover-card.js`, `tests/ui/hover-card.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Failing test**

`tests/ui/hover-card.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHoverCard } from '@/ui/hover-card.js';

beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });

describe('hover card', () => {
  it('shows after debounce delay', () => {
    const hc = createHoverCard({ delay: 120 });
    hc.show({ displayName: 'Mars', realMass_kg: 6.4e23, realRadius_m: 3.4e6, description: 'Red' }, 100, 100);
    expect(document.querySelector('.hover-card')).toBeFalsy();
    vi.advanceTimersByTime(120);
    expect(document.querySelector('.hover-card')).toBeTruthy();
  });
  it('hide() before delay cancels show', () => {
    const hc = createHoverCard({ delay: 120 });
    hc.show({ displayName: 'X' }, 0, 0); hc.hide();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.hover-card')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Implement**

`src/ui/hover-card.js`:

```js
const CARD_OFFSET = 16;

export function createHoverCard({ delay = 120 } = {}) {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let timer = null, el = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('div'); el.className = 'hover-card';
    document.body.appendChild(el); return el;
  }

  function show(body, clientX, clientY) {
    if (isTouch) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const e = ensureEl();
      e.innerHTML = `
        <div class="hc-name">${body.displayName}</div>
        <div class="hc-row"><span>Mass</span><span>${(body.realMass_kg ?? 0).toExponential(2)} kg</span></div>
        <div class="hc-row"><span>Radius</span><span>${(body.realRadius_m ?? 0).toExponential(2)} m</span></div>
        <div class="hc-desc">${body.description ?? ''}</div>`;
      // clamp inside viewport
      const x = Math.min(window.innerWidth - 280, clientX + CARD_OFFSET);
      const y = Math.min(window.innerHeight - 120, clientY + CARD_OFFSET);
      e.style.left = x + 'px'; e.style.top = y + 'px'; e.classList.add('hc-shown');
    }, delay);
  }

  function hide() {
    clearTimeout(timer);
    if (el) el.classList.remove('hc-shown');
  }

  return { show, hide };
}
```

CSS:

```css
.hover-card { position: fixed; max-width: 260px; padding: 10px 12px; background: rgba(15,15,25,0.92); border: 1px solid #2a2a3a; border-radius: 6px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 120ms; z-index: 100; }
.hover-card.hc-shown { opacity: 1; }
.hc-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.hc-row { display: flex; justify-content: space-between; opacity: 0.7; }
.hc-desc { margin-top: 6px; opacity: 0.6; font-size: 11px; }
```

- [ ] **Step 3: Wire into raycaster**

In `main.js`, hook `onHover`:

```js
import { createHoverCard } from '@/ui/hover-card.js';
const hover = createHoverCard();
const lastMouse = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointermove', (e) => { lastMouse.x = e.clientX; lastMouse.y = e.clientY; });

// extend the raycaster onHover:
onHover: (rec, prev) => {
  if (prev) prev.hovered = false;
  if (rec) { rec.hovered = true; hover.show(rec.body, lastMouse.x, lastMouse.y); }
  else hover.hide();
},
```

Also add 200 ms grace before clearing `hovered = false` to avoid LOD thrash:

```js
let hoverGrace = null;
onHover: (rec, prev) => {
  if (prev) {
    clearTimeout(hoverGrace);
    hoverGrace = setTimeout(() => { prev.hovered = false; }, 200);
  }
  if (rec) { rec.hovered = true; hover.show(rec.body, lastMouse.x, lastMouse.y); }
  else hover.hide();
},
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(ui): debounced hover card + 200ms LOD grace"
```

---

### Task 21: Drag-and-drop with ghost preview + auto-orbital velocity

**Files:**
- Create: `src/interaction/drag-drop.js`, `tests/interaction/drag-drop.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Failing test (pure logic — orbital velocity)**

`tests/interaction/drag-drop.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { circularOrbitVelocity } from '@/interaction/drag-drop.js';
import { G } from '@/physics/constants.js';

describe('circularOrbitVelocity', () => {
  it('produces v = sqrt(GM/r) tangent to up vector', () => {
    const center = new Vector3(0,0,0);
    const point = new Vector3(1.5e11, 0, 0); // 1 AU
    const up = new Vector3(0,1,0);
    const v = circularOrbitVelocity(point, center, 1.989e30, up);
    const expected = Math.sqrt(G * 1.989e30 / 1.5e11);
    expect(Math.abs(v.length() - expected) / expected).toBeLessThan(0.01);
    expect(Math.abs(v.x)).toBeLessThan(1); // perpendicular to radial
  });
});
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement drag-drop**

`src/interaction/drag-drop.js`:

```js
import { Vector3, Plane, Raycaster, Vector2, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';
import { G, DISTANCE_SCALE } from '@/physics/constants.js';

const NEIGHBOR_RANGE_UNITS = 50;
const MIN_MASS_FOR_ORBIT_KG = 1e22;

export function circularOrbitVelocity(point, center, M, upVec) {
  const radial = new Vector3().subVectors(point, center);
  const r = radial.length();
  if (r === 0) return new Vector3();
  const speed = Math.sqrt(G * M / r);
  const tangent = new Vector3().crossVectors(upVec, radial).normalize();
  return tangent.multiplyScalar(speed);
}

export function createDragDrop({ scene, camera, domElement, manifest, engine, getRecords, spawn }) {
  const ray = new Raycaster();
  const mouse = new Vector2();
  const plane = new Plane();
  const intersect = new Vector3();
  let armedId = null; // sidebar item being dragged
  let ghost = null;

  function makeGhost(body) {
    const m = new Mesh(new SphereGeometry(1, 16, 16), new MeshBasicMaterial({ color: body.defaultColor, transparent: true, opacity: 0.4, depthWrite: false }));
    m.scale.setScalar(0.4);
    return m;
  }

  function projectMouseToPlane(clientX, clientY, out) {
    const r = domElement.getBoundingClientRect();
    mouse.x = ((clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const target = camera.getWorldDirection(new Vector3()).multiplyScalar(0).add(camera.userData.target ?? new Vector3());
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()).negate(), target);
    return ray.ray.intersectPlane(plane, out);
  }

  function findNeighborMass(scenePosUnits) {
    const records = getRecords();
    let nearest = null, dist = Infinity;
    for (const r of records) {
      if (r.body.realMass_kg < MIN_MASS_FOR_ORBIT_KG) continue;
      const d = r.object.position.distanceTo(scenePosUnits);
      if (d < dist && d < NEIGHBOR_RANGE_UNITS) { dist = d; nearest = r; }
    }
    return nearest;
  }

  function dropAt(bodyId, clientX, clientY) {
    const body = manifest.bodies.find(b => b.id === bodyId);
    if (!body) return;
    const sceneUnits = projectMouseToPlane(clientX, clientY, new Vector3());
    if (!sceneUnits) return;

    const positionM = sceneUnits.clone().divideScalar(DISTANCE_SCALE).toArray();
    const neighbor = findNeighborMass(sceneUnits);
    let velocityMs = [0,0,0];
    if (neighbor) {
      const neighborPosM = new Vector3(...neighbor.object.position.toArray()).divideScalar(DISTANCE_SCALE);
      const upVec = camera.up.clone();
      const v = circularOrbitVelocity(new Vector3(...positionM), neighborPosM, neighbor.body.realMass_kg, upVec);
      velocityMs = v.toArray();
    }
    spawn(body, positionM, velocityMs);
    if (ghost) { scene.remove(ghost); ghost = null; }
  }

  // HTML5 drag-and-drop on the canvas
  domElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!ghost && armedId) {
      const body = manifest.bodies.find(b => b.id === armedId);
      if (body) { ghost = makeGhost(body); scene.add(ghost); }
    }
    if (ghost) {
      const out = new Vector3();
      if (projectMouseToPlane(e.clientX, e.clientY, out)) ghost.position.copy(out);
    }
  });
  domElement.addEventListener('drop', (e) => {
    e.preventDefault();
    const id = armedId ?? e.dataTransfer?.getData('text/plain');
    if (id) dropAt(id, e.clientX, e.clientY);
    armedId = null;
  });
  domElement.addEventListener('dragleave', () => { if (ghost) { scene.remove(ghost); ghost = null; } });

  // Touch fallback: tap-to-arm + tap canvas
  let armedForTap = null;
  function armForTapAdd(id) { armedForTap = id; }
  domElement.addEventListener('click', (e) => {
    if (!armedForTap) return;
    dropAt(armedForTap, e.clientX, e.clientY);
    armedForTap = null;
  });

  function beginDragFromSidebar(id) { armedId = id; }

  return { beginDragFromSidebar, armForTapAdd };
}
```

Note: plane projection uses `camera.userData.target` — wire it from `cam.target` each frame in `main.js`.

- [ ] **Step 3: Wire into main.js**

```js
import { createDragDrop } from '@/interaction/drag-drop.js';
const dragDrop = createDragDrop({
  scene, camera, domElement: renderer.domElement, manifest, engine,
  getRecords: () => records,
  spawn: (body, pos, vel) => spawnFromManifest(body, pos, vel),
});
// keep camera.userData.target updated for the drop plane:
cam.controls.addEventListener('change', () => { camera.userData.target = cam.target; });
camera.userData.target = cam.target;
```

- [ ] **Step 4: Manual verify** — drag Mercury onto canvas: ghost follows cursor, drop spawns Mercury that begins orbiting the Sun (visible if Sun is within 50 units of drop).

Run unit test. PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(interaction): drag-drop spawn with ghost + auto-orbital velocity"
```

---

### Task 22: Mass slider + visual size slider + supernova

**Files:**
- Create: `src/ui/mass-slider.js`, `src/fx/supernova.js`, `tests/fx/supernova.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Failing supernova-decision test**

`tests/fx/supernova.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { chooseRemnant } from '@/fx/supernova.js';

describe('chooseRemnant', () => {
  const M_SUN = 1.989e30;
  it('white dwarf for ≤ 1.4 M☉ post-loss', () => { expect(chooseRemnant(1.0 * M_SUN)).toBe('white_dwarf'); });
  it('neutron star for 1.4–3 M☉', () => { expect(chooseRemnant(2.5 * M_SUN)).toBe('neutron_star'); });
  it('black hole for > 3 M☉', () => { expect(chooseRemnant(10 * M_SUN)).toBe('bh_stellar'); });
});
```

- [ ] **Step 2: Implement supernova decision + effect stub**

`src/fx/supernova.js`:

```js
const M_SUN = 1.989e30;
export function chooseRemnant(postLossMassKg) {
  if (postLossMassKg <= 1.4 * M_SUN) return 'white_dwarf';
  if (postLossMassKg <= 3 * M_SUN)   return 'neutron_star';
  return 'bh_stellar';
}

export function triggerSupernova({ scene, position }) {
  // Particle burst: BufferGeometry of N points, additively blended, fading over 2s.
  // Implementation: keep simple — Points + a uniform t.
  // (Full GLSL particle pass can be added in Stage 4.)
}
```

- [ ] **Step 3: Mass slider UI (per-selected) + global visual size**

`src/ui/mass-slider.js`:

```js
import { SUPERNOVA_THRESHOLD_KG } from '@/physics/constants.js';
import { chooseRemnant, triggerSupernova } from '@/fx/supernova.js';

export function createMassControls({ getSelected, engine, manifest, getRecord, removeRecord, spawn, scene, confirmFn = (msg) => window.confirm(msg) }) {
  const root = document.createElement('div');
  root.className = 'mass-controls';
  root.innerHTML = `
    <label>Visual size <input class="mc-size" type="range" min="0.1" max="100" step="0.1" value="1"></label>
    <label>Mass × <input class="mc-mass" type="range" min="0.01" max="1000" step="0.01" value="1" disabled></label>
    <span class="mc-mass-val">1.00×</span>`;
  document.getElementById('ui-root').appendChild(root);
  const size = root.querySelector('.mc-size');
  const mass = root.querySelector('.mc-mass');
  const massVal = root.querySelector('.mc-mass-val');

  function visualSize() { return +size.value; }
  size.addEventListener('input', () => {
    for (const rec of getRecord('all')) rec.object.scale.setScalar(rec._baseScale * visualSize());
  });

  function refreshMassEnabled() {
    const sel = getSelected();
    mass.disabled = !sel;
    if (sel) {
      const s = engine.getState(sel.id);
      const factor = s.mass / sel.body.realMass_kg;
      mass.value = String(Math.max(0.01, Math.min(1000, factor)));
      massVal.textContent = (+mass.value).toFixed(2) + '×';
    } else {
      mass.value = '1'; massVal.textContent = '1.00×';
    }
  }

  mass.addEventListener('input', () => {
    const sel = getSelected(); if (!sel) return;
    const factor = +mass.value;
    const newMass = sel.body.realMass_kg * factor;
    massVal.textContent = factor.toFixed(2) + '×';
    engine.setState(sel.id, { mass: newMass });

    // Supernova check (only stars)
    if (sel.body.category === 'Stars' && newMass > SUPERNOVA_THRESHOLD_KG) {
      const ok = confirmFn(`This will destroy ${sel.body.displayName} in a supernova. Continue?`);
      if (!ok) {
        engine.setState(sel.id, { mass: sel.body.realMass_kg });
        mass.value = '1'; massVal.textContent = '1.00×';
        return;
      }
      const remnantId = chooseRemnant(newMass * 0.5); // half mass lost
      const state = engine.getState(sel.id);
      triggerSupernova({ scene, position: state.position });
      engine.removeBody(sel.id);
      removeRecord(sel.id);
      const remnantSpec = manifest.bodies.find(b => b.id === remnantId);
      spawn(remnantSpec, state.position, state.velocity);
    }
  });

  return { visualSize, refreshMassEnabled };
}
```

CSS:

```css
.mass-controls { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px; align-items: center; padding: 8px 14px; background: rgba(15,15,25,0.7); border: 1px solid #2a2a3a; border-radius: 8px; font-size: 11px; }
.mass-controls label { display: flex; align-items: center; gap: 8px; }
.mass-controls input[type=range] { width: 120px; }
.mc-mass-val { opacity: 0.7; min-width: 48px; text-align: right; }
```

- [ ] **Step 4: Wire into main.js**

```js
import { createMassControls } from '@/ui/mass-slider.js';
const mc = createMassControls({
  getSelected: () => selected,
  engine, manifest,
  getRecord: (q) => q === 'all' ? records : records.find(r => r.id === q),
  removeRecord: (id) => {
    const i = records.findIndex(r => r.id === id);
    if (i >= 0) { scene.remove(records[i].object); records.splice(i, 1); }
  },
  spawn: spawnFromManifest, scene,
});
// also store baseScale in spawnFromManifest:
//   rec._baseScale = renderRadius;
// (already created `renderRadius` in Task 17 — assign onto rec)
// On selection change, mc.refreshMassEnabled();
```

In the selection callback, call `mc.refreshMassEnabled()`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(ui): per-body mass slider, global visual size, supernova trigger"
```

---

### Task 23: Reset, presets, autosave/restore

**Files:**
- Create: `src/ui/reset-presets.js`, `src/persistence/autosave.js`, `tests/persistence/autosave.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Failing autosave test**

`tests/persistence/autosave.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAutosave } from '@/persistence/autosave.js';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });

describe('autosave', () => {
  it('writes a snapshot debounced after changes', () => {
    const a = createAutosave({ key: 'k', getSnapshot: () => ({ a: 1 }), debounceMs: 1000 });
    a.markDirty(); a.markDirty(); a.markDirty();
    vi.advanceTimersByTime(999);
    expect(localStorage.getItem('k')).toBeNull();
    vi.advanceTimersByTime(2);
    expect(JSON.parse(localStorage.getItem('k'))).toEqual({ a: 1 });
  });
  it('load returns null when nothing saved', () => {
    const a = createAutosave({ key: 'k', getSnapshot: () => ({}) });
    expect(a.load()).toBeNull();
  });
});
```

- [ ] **Step 2: Implement autosave**

`src/persistence/autosave.js`:

```js
export function createAutosave({ key, getSnapshot, debounceMs = 5000 }) {
  let timer = null;
  function markDirty() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(getSnapshot())); } catch {}
    }, debounceMs);
  }
  function load() {
    const raw = localStorage.getItem(key); if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function clear() { localStorage.removeItem(key); }
  return { markDirty, load, clear };
}
```

Run test. PASS.

- [ ] **Step 3: Reset + presets UI**

`src/ui/reset-presets.js`:

```js
const PRESETS = ['empty', 'inner_planets', 'jupiter_system', 'solar_system'];

export function createResetPresets({ onReset, onPreset }) {
  const root = document.createElement('div');
  root.className = 'reset-presets';
  root.innerHTML = `
    <button class="rp-reset">Reset</button>
    <select class="rp-preset">
      <option value="">Load preset…</option>
      ${PRESETS.map(p => `<option value="${p}">${p.replace(/_/g,' ')}</option>`).join('')}
    </select>`;
  document.getElementById('ui-root').appendChild(root);
  root.querySelector('.rp-reset').addEventListener('click', onReset);
  root.querySelector('.rp-preset').addEventListener('change', (e) => { if (e.target.value) onPreset(e.target.value); e.target.value = ''; });
}
```

CSS:

```css
.reset-presets { position: fixed; top: 16px; right: 320px; display: flex; gap: 8px; }
.reset-presets button, .reset-presets select { background: rgba(15,15,25,0.7); border: 1px solid #2a2a3a; color: #ddd; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
```

- [ ] **Step 4: Preset definitions**

Create `src/data/presets.js`:

```js
import manifest from './bodies.json';
import { G } from '@/physics/constants.js';

const AU = 1.496e11;
const M_SUN = manifest.bodies.find(b => b.id === 'sun').realMass_kg;
const orbitalV = (a) => Math.sqrt(G * M_SUN / a);

export const PRESETS = {
  empty: () => [],
  inner_planets: () => [
    { id: 'sun', position: [0,0,0], velocity: [0,0,0] },
    { id: 'mercury', position: [0.387*AU,0,0], velocity: [0,orbitalV(0.387*AU),0] },
    { id: 'venus',   position: [0.723*AU,0,0], velocity: [0,orbitalV(0.723*AU),0] },
    { id: 'earth',   position: [1.000*AU,0,0], velocity: [0,orbitalV(1.000*AU),0] },
    { id: 'mars',    position: [1.524*AU,0,0], velocity: [0,orbitalV(1.524*AU),0] },
  ],
  jupiter_system: () => [
    { id: 'jupiter', position: [0,0,0], velocity: [0,0,0] },
    // moons relative to Jupiter
    { id: 'io',       position: [4.22e8,0,0],  velocity: [0,17334,0] },
    { id: 'europa',   position: [6.71e8,0,0],  velocity: [0,13740,0] },
    { id: 'ganymede', position: [1.07e9,0,0],  velocity: [0,10880,0] },
  ],
  solar_system: () => [
    { id: 'sun', position: [0,0,0], velocity: [0,0,0] },
    ...['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'].map((id, i) => {
      const a = [0.387,0.723,1.000,1.524,5.203,9.537,19.191,30.069][i] * AU;
      return { id, position: [a,0,0], velocity: [0, orbitalV(a), 0] };
    }),
  ],
};
```

- [ ] **Step 5: Wire reset + presets + autosave**

In `main.js`:

```js
import { createResetPresets } from '@/ui/reset-presets.js';
import { createAutosave } from '@/persistence/autosave.js';
import { PRESETS } from '@/data/presets.js';

function clearAll() {
  for (const r of records) scene.remove(r.object);
  records.length = 0;
  engine.clear();
  selected = null; props.update(null);
}
function loadPreset(name) {
  clearAll();
  for (const e of PRESETS[name]()) {
    const spec = manifest.bodies.find(b => b.id === e.id);
    if (spec) spawnFromManifest(spec, e.position, e.velocity);
  }
}
createResetPresets({ onReset: clearAll, onPreset: loadPreset });

const autosave = createAutosave({
  key: 'space-sim:sandbox',
  getSnapshot: () => records.map(r => ({ id: r.id, ...engine.getState(r.id) })),
  debounceMs: 5000,
});
// On any spawn / drop / mass change, call autosave.markDirty()
// (extend spawnFromManifest, removeRecord, mass-slider input)

// On boot, offer restore
const prev = autosave.load();
if (prev && prev.length) {
  if (window.confirm('Restore previous session?')) {
    clearAll();
    for (const s of prev) {
      const spec = manifest.bodies.find(b => b.id === s.id);
      if (spec) spawnFromManifest(spec, s.position, s.velocity);
    }
  } else {
    autosave.clear();
  }
}
```

- [ ] **Step 6: Manual verify** — load Solar System preset; planets visible orbiting. Refresh page → restore prompt → restored state.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: reset, presets, debounced localStorage autosave with restore prompt"
```

---

### Task 24: Toasts + WebGL2 detection + touch banner

**Files:**
- Create: `src/ui/toast.js`, `tests/ui/toast.test.js`
- Modify: `src/main.js`, `src/loader/model-loader.js` (emit miss event)

- [ ] **Step 1: Toast test**

`tests/ui/toast.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToaster } from '@/ui/toast.js';

beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });

describe('toaster', () => {
  it('shows a toast and auto-dismisses', () => {
    const t = createToaster();
    t.show('hello');
    expect(document.querySelector('.toast').textContent).toBe('hello');
    vi.advanceTimersByTime(4100);
    expect(document.querySelector('.toast')).toBeFalsy();
  });
  it('dedupes the same message within 5s', () => {
    const t = createToaster();
    t.show('x'); t.show('x'); t.show('x');
    expect(document.querySelectorAll('.toast').length).toBe(1);
  });
});
```

- [ ] **Step 2: Implement toaster**

`src/ui/toast.js`:

```js
export function createToaster() {
  const root = document.createElement('div'); root.className = 'toaster'; document.body.appendChild(root);
  const recent = new Set();
  function show(msg) {
    if (recent.has(msg)) return;
    recent.add(msg); setTimeout(() => recent.delete(msg), 5000);
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  return { show };
}
```

CSS:

```css
.toaster { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 50; }
.toast { background: rgba(60,30,30,0.92); border: 1px solid #722; color: #fbb; padding: 8px 12px; border-radius: 6px; font-size: 12px; }
```

- [ ] **Step 3: WebGL2 detection in main.js**

At the very top of `main.js`:

```js
const testCanvas = document.createElement('canvas');
if (!testCanvas.getContext('webgl2')) {
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f88;font-family:sans-serif">WebGL2 not available — please update your browser.</div>`;
  throw new Error('no webgl2');
}
```

Touch banner:

```js
if ('ontouchstart' in window) {
  toaster.show('Touch device: hover cards disabled. Tap a sidebar item then tap canvas to spawn.');
}
```

Hook the model loader miss → toast:

```js
// In createModelLoader, accept onMiss callback; in main.js pass:
//   onMiss: (name) => toaster.show(`Couldn't load model for ${name} — using placeholder`)
```

- [ ] **Step 4: Commit + tag stage**

```bash
git add .
git commit -m "feat(ui): toasts + WebGL2 detection + touch banner + miss toast"
git tag stage-3-ui
```

**STOP. Demo to user. Wait for explicit "go for Stage 4" before continuing.**

---

# Stage 4 — Shaders & FX

> **Gate:** Procedural star (temperature → color), randomized volumetric nebula, black-hole gravitational lensing, layer-based selective bloom, Saturn rings overlay, Earth clouds. Performance budgets per §7.15 met. **End.**

---

### Task 25: Procedural star material

**Files:**
- Create: `src/shaders/star-material.js`, `tests/shaders/star-material.test.js`
- Modify: spawnFromManifest in `main.js` to use it for `procedural === 'star'`

- [ ] **Step 1: Smoke test material constructor**

`tests/shaders/star-material.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createStarMaterial } from '@/shaders/star-material.js';

describe('star material', () => {
  it('returns a ShaderMaterial with temperature uniform', () => {
    const m = createStarMaterial({ temperature_K: 5778 });
    expect(m.isShaderMaterial).toBe(true);
    expect(m.uniforms.uTemp.value).toBeCloseTo(5778);
  });
});
```

- [ ] **Step 2: Implement**

`src/shaders/star-material.js`:

```js
import { ShaderMaterial, Color } from 'three';

// Approximate blackbody color from Kelvin (Tanner Helland's algorithm, simplified).
function bbColor(T) {
  T = Math.max(1000, Math.min(40000, T)) / 100;
  let r, g, b;
  if (T <= 66) { r = 255; g = 99.4708025861 * Math.log(T) - 161.1195681661; }
  else        { r = 329.698727446 * Math.pow(T - 60, -0.1332047592); g = 288.1221695283 * Math.pow(T - 60, -0.0755148492); }
  if (T >= 66) b = 255;
  else if (T <= 19) b = 0;
  else b = 138.5177312231 * Math.log(T - 10) - 305.0447927307;
  const c = (x) => Math.max(0, Math.min(255, x)) / 255;
  return new Color(c(r), c(g), c(b));
}

export function createStarMaterial({ temperature_K = 5778 } = {}) {
  const color = bbColor(temperature_K);
  return new ShaderMaterial({
    uniforms: {
      uTemp: { value: temperature_K },
      uColor: { value: color },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vN; varying vec3 vP;
      // simple limb darkening + flicker
      void main(){
        float fresnel = pow(1.0 - abs(dot(vN, vec3(0.0,0.0,1.0))), 2.0);
        float flicker = 0.95 + 0.05 * sin(uTime * 2.0 + vP.x * 0.7);
        vec3 col = uColor * (1.2 - 0.4 * fresnel) * flicker;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
```

In `main.js`, branch in `spawnFromManifest`:

```js
import { createStarMaterial } from '@/shaders/star-material.js';
import { Mesh, SphereGeometry } from 'three';
// inside spawnFromManifest:
let mesh;
if (spec.procedural === 'star') {
  mesh = new Mesh(new SphereGeometry(1, 64, 64), createStarMaterial({ temperature_K: spec.temperature_K }));
  mesh.layers.enable(1); // bloom layer (Task 28)
} else {
  mesh = makePlaceholder(spec);
}
```

Update `uTime` per frame in `tick`:

```js
for (const r of records) {
  if (r.object.material?.uniforms?.uTime) r.object.material.uniforms.uTime.value += dt;
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(shaders): procedural star material with blackbody color"
```

---

### Task 26: Randomized volumetric nebula

**Files:**
- Create: `src/shaders/nebula-material.js`, `tests/shaders/nebula-material.test.js`

- [ ] **Step 1: Smoke test**

```js
import { describe, it, expect } from 'vitest';
import { createNebulaMaterial } from '@/shaders/nebula-material.js';
describe('nebula material', () => {
  it('randomized color uniform differs across instances', () => {
    const a = createNebulaMaterial(); const b = createNebulaMaterial();
    expect(a.uniforms.uColorA.value.equals(b.uniforms.uColorA.value)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

`src/shaders/nebula-material.js`:

```js
import { ShaderMaterial, Color, AdditiveBlending } from 'three';

const NOISE_GLSL = `
// Inigo Quilez 3D simplex noise (truncated for brevity in plan; copy full impl from his MIT-licensed source).
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)))*43758.5453); }
float n3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)), hash3(i+vec3(1,0,0)), f.x),
                 mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
                 mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s += a*n3(p); p*=2.05; a*=0.5; } return s; }
`;

function rndColor() { return new Color().setHSL(Math.random(), 0.7 + Math.random() * 0.3, 0.55); }

export function createNebulaMaterial() {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: rndColor() },
      uColorB: { value: rndColor() },
      uSeed: { value: Math.random() * 100 },
    },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColorA, uColorB; uniform float uSeed;
      varying vec3 vP;
      ${NOISE_GLSL}
      void main(){
        vec3 p = vP * 0.05 + vec3(uSeed);
        float d = fbm(p + vec3(0.0, uTime*0.05, 0.0));
        float a = smoothstep(0.45, 0.85, d);
        vec3 col = mix(uColorA, uColorB, fbm(p * 1.7));
        gl_FragColor = vec4(col, a * 0.6);
      }`,
  });
}
```

Use in `spawnFromManifest` for `procedural === 'nebula'` with a large `SphereGeometry(50, 64, 64)`.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(shaders): randomized volumetric nebula"
```

---

### Task 27: Black hole material + lensing pass

**Files:**
- Create: `src/shaders/black-hole-material.js`, `src/render/lensing-pass.js`

- [ ] **Step 1: Black hole sphere material (event horizon + thin accretion disk)**

```js
// src/shaders/black-hole-material.js
import { ShaderMaterial } from 'three';
export function createBlackHoleMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; varying vec3 vN;
      void main(){
        // pure black sphere; lensing is a screen-space pass (lensing-pass.js)
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      }`,
  });
}
```

- [ ] **Step 2: Lensing screen-space pass**

`src/render/lensing-pass.js`:

```js
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Vector2, Vector3 } from 'three';

const LensingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uHoles: { value: [new Vector2(-9999,-9999), new Vector2(-9999,-9999)] }, // up to 2 holes (screen NDC)
    uStrengths: { value: [0, 0] },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uHoles[2];
    uniform float uStrengths[2];
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      for (int i = 0; i < 2; i++) {
        vec2 d = uv - uHoles[i];
        float r = length(d);
        if (r < 0.001 || uStrengths[i] <= 0.0) continue;
        float bend = uStrengths[i] / (r * r + 0.02);
        uv -= normalize(d) * bend;
      }
      gl_FragColor = texture2D(tDiffuse, uv);
    }`,
};

export function createLensingPass({ camera, getBlackHoles }) {
  const pass = new ShaderPass(LensingShader);
  function update() {
    const holes = getBlackHoles().slice(0, 2);
    for (let i = 0; i < 2; i++) {
      if (i < holes.length) {
        const h = holes[i];
        const ndc = h.object.position.clone().project(camera);
        pass.material.uniforms.uHoles.value[i].set((ndc.x + 1) * 0.5, (ndc.y + 1) * 0.5);
        // Strength scaled by screen size of body (close-up = larger)
        pass.material.uniforms.uStrengths.value[i] = Math.min(0.06, 0.001 * h.body.realRadius_m / 1e7);
      } else {
        pass.material.uniforms.uHoles.value[i].set(-9999, -9999);
        pass.material.uniforms.uStrengths.value[i] = 0;
      }
    }
  }
  return { pass, update };
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(shaders): black hole material + screen-space lensing pass"
```

---

### Task 28: Selective bloom (layer-based)

**Files:**
- Create: `src/render/selective-bloom.js`
- Modify: `src/main.js` to use a composer pipeline

- [ ] **Step 1: Implement layered bloom composer**

`src/render/selective-bloom.js`:

```js
import { Layers, ShaderMaterial, MeshBasicMaterial, Color } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Vector2 } from 'three';

const BLOOM_LAYER = 1;
const dark = new MeshBasicMaterial({ color: 0x000000 });

export function createSelectiveBloomComposer({ renderer, scene, camera }) {
  const bloomLayer = new Layers(); bloomLayer.set(BLOOM_LAYER);
  const size = renderer.getSize(new Vector2());

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(size, 1.2, 0.4, 0.0));

  const finalShader = {
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv;
      void main(){ gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0)*texture2D(bloomTexture, vUv); }`,
  };
  const finalPass = new ShaderPass(new ShaderMaterial({ uniforms: finalShader.uniforms, vertexShader: finalShader.vertexShader, fragmentShader: finalShader.fragmentShader, defines: {} }), 'baseTexture');

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(finalPass);

  const materialsCache = new Map();
  function darkenNonBloomed(obj) {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
      materialsCache.set(obj.uuid, obj.material); obj.material = dark;
    }
  }
  function restoreMaterial(obj) {
    if (materialsCache.has(obj.uuid)) { obj.material = materialsCache.get(obj.uuid); materialsCache.delete(obj.uuid); }
  }
  function render() {
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);
    finalComposer.render();
  }
  function setSize(w, h) { bloomComposer.setSize(w, h); finalComposer.setSize(w, h); }
  return { render, setSize };
}
```

- [ ] **Step 2: Wire in main.js**

Replace `renderer.render(scene, camera)` with composer:

```js
import { createSelectiveBloomComposer } from '@/render/selective-bloom.js';
import { createLensingPass } from '@/render/lensing-pass.js';
const composer = createSelectiveBloomComposer({ renderer, scene, camera });
const lensing = createLensingPass({ camera, getBlackHoles: () => records.filter(r => r.body.procedural === 'black_hole') });
composer.finalComposer?.addPass?.(lensing.pass); // expose finalComposer if needed; or wire inside the composer factory.

// In tick:
lensing.update();
composer.render();
// Resize:
addEventListener('resize', () => { composer.setSize(innerWidth, innerHeight); });
```

(If wiring lensing into the composer factory needs more glue, add a `addExtraPass(pass)` method to `createSelectiveBloomComposer`.)

- [ ] **Step 3: Manual verify** — Sun glows; Earth in front does not halo. Black hole bends background.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(render): selective bloom + lensing in composer pipeline"
```

---

### Task 29: Saturn rings + Earth clouds overlays

**Files:**
- Create: `src/overlays/saturn-rings.js`, `src/overlays/earth-clouds.js`
- Modify: `main.js` post-spawn hook

- [ ] **Step 1: Saturn rings**

`src/overlays/saturn-rings.js`:

```js
import { Mesh, RingGeometry, ShaderMaterial, DoubleSide, Color, MathUtils } from 'three';

export function attachSaturnRings(parent, planetRadiusUnits) {
  const inner = planetRadiusUnits * 1.2;
  const outer = planetRadiusUnits * 2.3;
  const geom = new RingGeometry(inner, outer, 128);
  // remap UVs for radial gradient
  const uv = geom.attributes.uv;
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0);
  }
  const mat = new ShaderMaterial({
    transparent: true, side: DoubleSide, depthWrite: false,
    uniforms: { uColor: { value: new Color(0xd6c08a) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; varying vec2 vUv;
      float bands(float u){
        float b = 0.7 + 0.3*sin(u*40.0) * sin(u*17.0);
        b *= smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.7, u);
        return b;
      }
      void main(){
        float a = bands(vUv.x);
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const ring = new Mesh(geom, mat);
  ring.rotation.x = Math.PI / 2;
  ring.rotation.z = MathUtils.degToRad(26.7);
  parent.add(ring);
}
```

- [ ] **Step 2: Earth clouds**

`src/overlays/earth-clouds.js`:

```js
import { Mesh, SphereGeometry, ShaderMaterial, AdditiveBlending } from 'three';

export function attachEarthClouds(parent, planetRadiusUnits) {
  const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5); }
                 float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
                   return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
                 float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.05; a*=0.5;} return s; }`;
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main(){
        float c = fbm(vec2(vUv.x*6.0 + uTime*0.01, vUv.y*3.0));
        float a = smoothstep(0.55, 0.85, c);
        gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.55);
      }`,
  });
  const m = new Mesh(new SphereGeometry(planetRadiusUnits * 1.01, 64, 64), mat);
  parent.add(m);
  return m;
}
```

- [ ] **Step 3: Wire by overlay key**

In `spawnFromManifest`, after creating `mesh`:

```js
import { attachSaturnRings } from '@/overlays/saturn-rings.js';
import { attachEarthClouds } from '@/overlays/earth-clouds.js';
if (spec.overlay === 'rings')   attachSaturnRings(mesh, renderRadius);
if (spec.overlay === 'clouds')  attachEarthClouds(mesh, renderRadius);
```

Animate clouds/star uTime in `tick`.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(overlays): procedural Saturn rings + Earth clouds"
```

---

### Task 30: Performance pass + acceptance

**Files:** none new; verification only.

- [ ] **Step 1: Spawn the Solar System preset + add 20 random asteroids manually.**
- [ ] **Step 2: Open DevTools Performance tab; record 5 s; verify ≥ 60 fps sustained on a typical laptop.**
- [ ] **Step 3: Print `renderer.info.memory.textures` to console; verify < 512 MB sustained over 60 s of LOD thrash (orbit camera in/out across 150–200 unit band on multiple bodies).**
- [ ] **Step 4: Toggle slider 0/1 rapidly and verify pause-but-render still works.**
- [ ] **Step 5: Toggle network throttling in DevTools to "Slow 3G" and reload; verify loading screen progresses without hang.**

If any budget fails, identify the worst offender via the Performance tab and either:
- Reduce nebula sphere segment count
- Lower bloom resolution
- Drop the lensing pass when no black hole is selected
- Increase LOD downgrade threshold

- [ ] **Step 6: Final commit + tag**

```bash
git add .
git commit -m "perf: stage 4 acceptance pass"
git tag stage-4-fx
```

---

## Self-Review

Spec coverage check:

| §  | Requirement                                  | Task           |
|----|----------------------------------------------|----------------|
| 1  | Loading screen w/ progress, fade out         | 5, 6, 16       |
| 1  | LoadingManager + Wasm tracking               | 6, 16          |
| 1  | DISTANCE_SCALE + SIZE_SCALE                  | 7              |
| 2  | Budget 3 high-res                            | 15             |
| 2  | Priority order (selected/hovered/closest)    | 15             |
| 2  | 150/200 hysteresis                           | 15             |
| 2  | No flicker / same model both LODs            | 15, 17         |
| 3  | Adapt to existing `3D models/`               | 1 step 9, 12   |
| 3  | `_4k → _1k → bare` fallback                  | 12, 13         |
| 3  | Cache + miss-cache                           | 13             |
| 3  | Sphere fallback                              | 17 (placeholder is the fallback) |
| 4  | Sidebar + 6 categories + search              | 11, 18         |
| 4  | Properties panel real-time                   | 19             |
| 4  | Hover cards                                  | 20             |
| 5  | Strict 0..1 time slider                      | 9              |
| 5  | Pause renders, physics frozen                | 10             |
| 5  | Mass/scale slider + supernova                | 22             |
| 6  | Procedural stars                             | 25             |
| 6  | Randomized nebulae                           | 26             |
| 6  | Black hole lensing                           | 27, 28         |
| 7.1| Engine interface (swappable)                 | 7              |
| 7.2| Alias map, case-insensitive, miss-cache      | 12, 13         |
| 7.3| Body manifest                                | 11             |
| 7.4| Time base (1 day/sec)                        | 7, 9, 10       |
| 7.5| OrbitControls + log depth + ESC + focus      | 2, 4           |
| 7.6| Drag-drop spawn rules                        | 21             |
| 7.7| Two sliders + supernova confirmation         | 22             |
| 7.8| Selection / ESC / hover grace                | 19, 20         |
| 7.9| Frustum visibility                           | 14, 17         |
| 7.10| Wasm fetch shim                             | 6, 16          |
| 7.11| Selective bloom                             | 28             |
| 7.12| Saturn rings + Earth clouds                 | 29             |
| 7.13| Reset + presets + autosave                  | 23             |
| 7.14| Toasts + WebGL2 + touch banner              | 24             |
| 7.15| Performance budgets                         | 30             |
| 7.16| Stage gates                                 | end of each stage |

Type-consistency check: `engine.addBody/removeBody/getState/setState/step/all/clear` used the same way everywhere ✓. `record.{id,body,object,currentLod,selected,hovered,_distance,_baseScale,boundingSphere,syncFromEngine}` used consistently ✓. `manifest.bodies[].{id,displayName,category,assetName,procedural,realMass_kg,realRadius_m,defaultColor,description,overlay}` used consistently ✓.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-space-simulator.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session via executing-plans, batch with checkpoints at the 4 STOP-AND-WAIT gates.

**Which approach?**
