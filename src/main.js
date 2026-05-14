import { createScene } from '@/render/scene.js';
import { createStarfield } from '@/render/starfield.js';
import { createCameraController } from '@/interaction/camera-controls.js';
import { createLoadingScreen } from '@/ui/loading-screen.js';
import { createTimeSlider } from '@/ui/time-slider.js';
import { createPropertiesPanel } from '@/ui/properties-panel.js';
import { createHoverCard } from '@/ui/hover-card.js';
import { createSelectionRaycaster } from '@/interaction/raycaster.js';
import { createSidebar } from '@/ui/sidebar.js';
import { createDragDrop } from '@/interaction/drag-drop.js';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import {
  G, DISTANCE_SCALE, TIME_BASE_SECONDS_PER_REAL_SECOND, MAX_SUBSTEPS_PER_FRAME,
} from '@/physics/constants.js';
import { Raycaster, Vector2, AmbientLight, PointLight } from 'three';
import manifest from '@/data/bodies.json';
import { createLoadingOrchestrator } from '@/loader/loading-orchestrator.js';
import { createModelLoader } from '@/loader/model-loader.js';
import { createBodyRecord, makePlaceholder } from '@/lod/body-record.js';
import { createLodRuntime } from '@/lod/lod-runtime.js';
import { chooseRemnant, triggerSupernova } from '@/fx/supernova.js';
import { createDragResize } from '@/interaction/drag-resize.js';
import { findFirstCollision, resolveCollision } from '@/physics/collisions.js';
import { createResetPresets } from '@/ui/reset-presets.js';
import { createAutosave } from '@/persistence/autosave.js';
import { createToaster } from '@/ui/toast.js';
import { PRESETS } from '@/data/presets.js';
import { createSpacetimeGrid } from '@/render/spacetime-grid.js';
import { createBackgroundSelector } from '@/ui/background-selector.js';

const _testCanvas = document.createElement('canvas');
if (!_testCanvas.getContext('webgl2')) {
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f88;font-family:sans-serif;font-size:14px;text-align:center;padding:20px">WebGL2 not available — please update your browser or enable hardware acceleration.</div>`;
  throw new Error('no webgl2');
}

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, { width: innerWidth, height: innerHeight });
const starfield = createStarfield();
scene.add(starfield);

// Background-mode plane (gridlines / spacetime warp). Hidden by default; toggled by selector.
const spacetimeGrid = createSpacetimeGrid();
scene.add(spacetimeGrid.mesh);

createBackgroundSelector({
  initial: 'stars',
  onChange: (mode) => {
    starfield.visible = (mode === 'stars');
    spacetimeGrid.setMode(mode); // 'grid' | 'warp' shows the plane; 'stars' hides it
  },
});

// Lights so MeshStandardMaterial-based GLBs render properly. PointLight at the Sun's position
// gives a sun-lit look (decay=0 so its full intensity reaches Earth at 1 AU); ambient fills the
// dark side so it's not pitch black. Stage 4 will replace this with selective bloom + emissive
// star material when procedural shaders come in.
scene.add(new AmbientLight(0xffffff, 0.4));
scene.add(new PointLight(0xffffff, 1.5, 0, 0));

const cam = createCameraController(camera, renderer.domElement);

const loading = createLoadingScreen();
loading.setProgress(0);
const orch = createLoadingOrchestrator(loading);
const toaster = createToaster();
const modelLoader = createModelLoader({
  basePath: '/models/',
  manager: orch.manager,
  onMiss: (filename) => toaster.show(`Couldn't load ${filename} — using placeholder`),
});

if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  toaster.show('Touch device: hover cards disabled. Tap a sidebar item then tap canvas to spawn.');
}

const engine = createVerletEngine();
const records = [];

// Hoisted forward declarations referenced by spawnFromManifest / removeRecord BEFORE their
// real initialization further down. With `let`, accessing the binding before initialization
// is a TDZ ReferenceError (optional chaining can't catch that), so the binding must exist —
// initialised to null — before any function that reads it is called.
let autosave = null;

// Visible-size formula. Power-law on real radius (anchored to Earth = 3 units) preserves the
// real *relative* sizes — Sun ~17, Jupiter ~7.5, Earth/Venus ~3, Mars/Mercury ~2, Moon ~1.8.
// A floor keeps satellites / tiny asteroids visible. Showing the real 1:109 Sun:Earth ratio
// would make planets sub-pixel; the 0.38 exponent compresses the dynamic range while keeping
// the ordering correct (gas giants > rocky planets > moons > asteroids > satellites).
const EARTH_RENDER_R = 3.0;
const EARTH_REAL_R_M = 6.371e6;
const RADIUS_EXP = 0.38;
const MIN_RENDER_R = 0.6;
function visibleRadius(spec) {
  const r = Math.max(1e-9, (spec.realRadius_m ?? 0) / EARTH_REAL_R_M);
  return Math.max(MIN_RENDER_R, EARTH_RENDER_R * Math.pow(r, RADIUS_EXP));
}

function spawnFromManifest(spec, position = [0,0,0], velocity = [0,0,0]) {
  const placeholder = makePlaceholder(spec);
  const r = visibleRadius(spec);
  placeholder.scale.setScalar(r);
  placeholder.userData.bodyId = spec.id;
  scene.add(placeholder);
  engine.addBody({ id: spec.id, mass: spec.realMass_kg, position, velocity });
  const rec = createBodyRecord(spec, placeholder, r);
  records.push(rec);
  autosave?.markDirty();
  return rec;
}

function removeRecord(id) {
  const i = records.findIndex(r => r.id === id);
  if (i >= 0) {
    const r = records[i];
    scene.remove(r.object);
    // best-effort dispose
    r.object.traverse?.((n) => {
      n.geometry?.dispose?.();
      const mats = Array.isArray(n.material) ? n.material : (n.material ? [n.material] : []);
      for (const m of mats) m.dispose?.();
    });
    records.splice(i, 1);
    autosave?.markDirty();
  }
}

// Stage 2 demo: Sun + Earth from the manifest. Earth orbits the Sun in the XZ plane (ecliptic).
const sunSpec = manifest.bodies.find(b => b.id === 'sun');
const earthSpec = manifest.bodies.find(b => b.id === 'earth');
const AU = 1.496e11;
const v = Math.sqrt(G * sunSpec.realMass_kg / AU);
spawnFromManifest(sunSpec, [0,0,0], [0,0,0]);
spawnFromManifest(earthSpec, [AU,0,0], [0, 0, -v]);

const lodRuntime = createLodRuntime({ records, modelLoader, scene });

const slider = createTimeSlider({ initial: 0.5 }); // 0.5 → 1× real-time

const props = createPropertiesPanel();

const hover = createHoverCard();
const lastMouse = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointermove', (e) => {
  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
});

let selected = null;
let hoverGrace = null;
let followedId = null;     // id of the body the camera is currently following (for cleanup on remove)

createSelectionRaycaster({
  camera, domElement: renderer.domElement,
  getRecords: () => records,
  onSelect: (rec) => {
    if (selected) selected.selected = false;
    selected = rec;
    if (selected) selected.selected = true;
    if (!selected) props.update(null);
  },
  onHover: (rec, prev) => {
    if (prev) {
      clearTimeout(hoverGrace);
      hoverGrace = setTimeout(() => {
        prev.hovered = false;
      }, 200);
    }
    if (rec) {
      rec.hovered = true;
      hover.show(rec.body, lastMouse.x, lastMouse.y);
    } else {
      hover.hide();
    }
  },
});

const dragDrop = createDragDrop({
  scene, camera, domElement: renderer.domElement, manifest,
  getRecords: () => records,
  getCamTarget: () => cam.target,
  spawn: (body, pos, vel) => spawnFromManifest(body, pos, vel),
});
createSidebar({
  manifest,
  onDragStart: (id) => dragDrop.beginDragFromSidebar(id),
  onTapAdd: (id) => dragDrop.armForTapAdd(id),
});

// Click + drag a body to resize it (and scale its mass by r³). Stars going past 8 M☉ trigger
// the supernova chain automatically (no separate slider/dialog now that mass-controls is gone).
createDragResize({
  camera, domElement: renderer.domElement, cameraControls: cam,
  getRecords: () => records,
  engine,
  onSelect: (rec) => {
    if (selected) selected.selected = false;
    selected = rec;
    if (selected) selected.selected = true;
  },
  onSupernova: (rec, newMass) => goSupernova(rec, newMass),
});

function goSupernova(rec, newMass) {
  const remnantId = chooseRemnant(newMass * 0.5); // half mass shed in collapse
  const state = engine.getState(rec.id);
  if (!state) return;
  triggerSupernova({ scene, position: state.position });
  destroyBody(rec.id);
  const remnantSpec = manifest.bodies.find(b => b.id === remnantId);
  if (remnantSpec) spawnFromManifest(remnantSpec, state.position, state.velocity);
}

// Remove a body from both engine + scene, plus clear any UI/camera state referencing it.
function destroyBody(id) {
  if (selected?.id === id) {
    selected.selected = false;
    selected = null;
    props.update(null);
  }
  if (followedId === id) {
    followedId = null;
    cam.release();
  }
  engine.removeBody(id);
  removeRecord(id);
}

function clearAll() {
  for (const r of [...records]) destroyBody(r.id);
  records.length = 0;
  engine.clear();
  selected = null;
  followedId = null;
  props.update(null);
  cam.release();
}

function loadPreset(name) {
  clearAll();
  const entries = (PRESETS[name] || (() => []))();
  for (const e of entries) {
    const spec = manifest.bodies.find(b => b.id === e.id);
    if (spec) spawnFromManifest(spec, e.position, e.velocity);
  }
}

createResetPresets({ onReset: clearAll, onPreset: loadPreset });

autosave = createAutosave({
  key: 'space-sim:sandbox',
  getSnapshot: () => records.map(r => {
    const s = engine.getState(r.id);
    return s ? { id: r.id, mass: s.mass, position: s.position, velocity: s.velocity } : null;
  }).filter(Boolean),
  debounceMs: 5000,
});

// Restore previous session if one exists.
const _prev = autosave.load();
if (_prev && Array.isArray(_prev) && _prev.length > 0
    && (typeof window === 'undefined' || window.confirm('Restore previous session?'))) {
  clearAll();
  for (const s of _prev) {
    const spec = manifest.bodies.find(b => b.id === s.id);
    if (spec) spawnFromManifest(spec, s.position, s.velocity);
    if (spec && s.mass != null) engine.setState(s.id, { mass: s.mass });
  }
} else if (_prev) {
  // user declined or snapshot was empty — discard stale data
  autosave.clear();
}

// Double-click a body → camera pins/follows it. Double-click empty space → unpin/release.
// (Single click does nothing so OrbitControls can drag-rotate without accidentally pinning.)
const ray = new Raycaster();
const ndc = new Vector2();
renderer.domElement.addEventListener('dblclick', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  // pickables computed from current records — supports LOD swaps
  const pickables = records.map(r => r.object);
  const hits = ray.intersectObjects(pickables, true);
  if (!hits.length) { cam.release(); followedId = null; return; }
  // climb up to the record's root object so follow tracks the swap-replaced mesh
  let n = hits[0].object;
  while (n.parent && !records.some(r => r.object === n)) n = n.parent;
  const rec = records.find(r => r.object === n);
  if (rec) { cam.follow(() => rec.object.position); followedId = rec.id; }
  else { cam.release(); followedId = null; }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cam.release();
    followedId = null;
    if (selected) { selected.selected = false; selected = null; props.update(null); }
  }
});

// Reset View button.
const resetBtn = document.createElement('button');
resetBtn.className = 'reset-view-btn';
resetBtn.textContent = 'Reset View';
resetBtn.title = 'Restore default camera (also: ESC releases follow)';
resetBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
resetBtn.addEventListener('click', () => cam.resetView());
document.getElementById('ui-root').appendChild(resetBtn);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  cam.update(dt);

  let totalSimSec = 0;
  if (!slider.isPaused) {
    totalSimSec = slider.multiplier * TIME_BASE_SECONDS_PER_REAL_SECOND * dt;
    const subSec = totalSimSec / MAX_SUBSTEPS_PER_FRAME;
    for (let i = 0; i < MAX_SUBSTEPS_PER_FRAME; i++) engine.step(subSec);
  }

  for (const rec of records) {
    const s = engine.getState(rec.id); if (!s) continue;
    rec.syncFromEngine(s, camera);
    rec.spin(totalSimSec); // axial rotation; scales with the time-slider, pauses at 0
  }

  // Resolve at most one collision per frame; the next frame will catch any cascade.
  const pair = findFirstCollision(records);
  if (pair) {
    const { destroy } = resolveCollision(pair[0], pair[1]);
    for (const r of destroy) destroyBody(r.id);
  }

  lodRuntime.tick(camera);

  // Keep the spacetime-grid plane in sync with body positions/masses (cheap; uniforms only).
  if (spacetimeGrid.mesh.visible) spacetimeGrid.updateBodies(records);

  if (selected) {
    const s = engine.getState(selected.id);
    if (s) props.update({ body: selected.body, state: s, lod: selected.currentLod });
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Fade the loading screen once initial assets are done loading (or immediately on first frame
// if no assets are needed). Three.js LoadingManager.onLoad fires when its in-flight queue empties.
let faded = false;
function maybeFade() {
  if (faded) return;
  faded = true;
  loading.setProgress(1);
  loading.fadeOut();
}
orch.manager.onLoad = () => maybeFade();
// safety net: fade after first rendered frame even if no GLB requests have been queued yet
requestAnimationFrame(() => requestAnimationFrame(maybeFade));
