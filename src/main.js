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
import { createMassControls } from '@/ui/mass-slider.js';
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

// Visible-size formula tuned for AU-scale spacing — minimum 1 unit so dwarfs aren't sub-pixel.
function visibleRadius(spec) {
  return Math.max(1.0, Math.log10(spec.realRadius_m) * 0.5);
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

const slider = createTimeSlider({ initial: 0.75 }); // 0.75 → 10× — visible orbit in ~36s

const props = createPropertiesPanel();

const hover = createHoverCard();
const lastMouse = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointermove', (e) => {
  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
});

let selected = null;
let hoverGrace = null;
let massControls = null;

createSelectionRaycaster({
  camera, domElement: renderer.domElement,
  getRecords: () => records,
  onSelect: (rec) => {
    if (selected) selected.selected = false;
    selected = rec;
    if (selected) selected.selected = true;
    if (!selected) props.update(null);
    massControls?.refreshMassEnabled();
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

massControls = createMassControls({
  getSelected: () => selected,
  getRecords: () => records,
  engine, manifest, scene,
  spawn: spawnFromManifest,
  removeRecord,
});

function clearAll() {
  // Iterate a copy because removeRecord splices in-place.
  for (const r of [...records]) {
    engine.removeBody(r.id);
    removeRecord(r.id);
  }
  records.length = 0;
  engine.clear();
  selected = null;
  props.update(null);
  cam.release();
  massControls?.refreshMassEnabled?.();
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
  if (!hits.length) { cam.release(); return; }
  // climb up to the record's root object so follow tracks the swap-replaced mesh
  let n = hits[0].object;
  while (n.parent && !records.some(r => r.object === n)) n = n.parent;
  const rec = records.find(r => r.object === n);
  if (rec) cam.follow(() => rec.object.position);
  else cam.release();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cam.release();
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
