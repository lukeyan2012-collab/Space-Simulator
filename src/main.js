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
import { Raycaster, Vector2, Vector3, AmbientLight, PointLight, Mesh, SphereGeometry } from 'three';
import { createStarMaterial } from '@/shaders/star-material.js';
import { createNebulaMaterial } from '@/shaders/nebula-material.js';
import { createBlackHoleMaterial } from '@/shaders/black-hole-material.js';
import { attachSaturnRings } from '@/overlays/saturn-rings.js';
import { attachEarthClouds } from '@/overlays/earth-clouds.js';
import { createSelectiveBloom, BLOOM_LAYER } from '@/render/selective-bloom.js';
import { createLensingPass } from '@/render/lensing-pass.js';
import manifest from '@/data/bodies.json';
import { createLoadingOrchestrator } from '@/loader/loading-orchestrator.js';
import { createModelLoader } from '@/loader/model-loader.js';
import { createBodyRecord, makePlaceholder } from '@/lod/body-record.js';
import { createLodRuntime } from '@/lod/lod-runtime.js';
import { chooseRemnant, triggerSupernova } from '@/fx/supernova.js';
import { createDragResize } from '@/interaction/drag-resize.js';
import { createResetPresets } from '@/ui/reset-presets.js';
import { createAutosave } from '@/persistence/autosave.js';
import { createToaster } from '@/ui/toast.js';
import { PRESETS } from '@/data/presets.js';

const _testCanvas = document.createElement('canvas');
if (!_testCanvas.getContext('webgl2')) {
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f88;font-family:sans-serif;font-size:14px;text-align:center;padding:20px">WebGL2 not available — please update your browser or enable hardware acceleration.</div>`;
  throw new Error('no webgl2');
}

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, { width: innerWidth, height: innerHeight });
scene.add(createStarfield());

// Lights — bumped from earlier (ambient 0.4 / point 1.5) so the dark sides of GLB planets
// aren't a black void. Ambient gives a base brightness everywhere, the no-decay PointLight at
// the Sun's position adds directional sunlight that scales.
scene.add(new AmbientLight(0xffffff, 1.1));
scene.add(new PointLight(0xffffff, 2.8, 0, 0));

// Edit-mode selection ring — an HTML overlay drawn around the body's projected screen-space
// bounding circle (Google-Slides style). Only visible in EDIT mode, which the user enters by
// clicking a body that's already been double-click-pinned.
const editHalo = document.createElement('div');
editHalo.className = 'edit-halo';
editHalo.style.display = 'none';
document.body.appendChild(editHalo);

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

// Materials that need uTime updated every frame (stars, nebulae, cloud overlays).
const animatedMaterials = [];

function makeBodyMesh(spec) {
  // Procedural bodies get their specialized shader straight away; the LOD runtime knows to
  // skip the GLB swap for them.
  if (spec.procedural === 'star') {
    const mat = createStarMaterial({ temperature_K: spec.temperature_K });
    animatedMaterials.push(mat);
    const m = new Mesh(new SphereGeometry(1, 64, 64), mat);
    m.layers.enable(BLOOM_LAYER); // stars glow via the selective-bloom pass
    return m;
  }
  if (spec.procedural === 'nebula') {
    const mat = createNebulaMaterial();
    animatedMaterials.push(mat);
    return new Mesh(new SphereGeometry(1, 48, 48), mat);
  }
  if (spec.procedural === 'black_hole') {
    return new Mesh(new SphereGeometry(1, 32, 32), createBlackHoleMaterial());
  }
  // Asset-backed bodies start as a colored placeholder; LOD runtime swaps in the GLB.
  return makePlaceholder(spec);
}

function spawnFromManifest(spec, position = [0,0,0], velocity = [0,0,0]) {
  const mesh = makeBodyMesh(spec);
  const r = visibleRadius(spec);
  mesh.scale.setScalar(r);
  mesh.userData.bodyId = spec.id;
  scene.add(mesh);
  engine.addBody({ id: spec.id, mass: spec.realMass_kg, position, velocity });
  const rec = createBodyRecord(spec, mesh, r);
  rec.overlays = [];

  // Procedural overlays (rings/clouds) — children of the body's mesh so they inherit
  // position/scale/spin. The LOD runtime re-attaches them when an asset GLB swaps in.
  if (spec.overlay === 'rings') {
    rec.overlays.push(attachSaturnRings(mesh));
  }
  if (spec.overlay === 'clouds') {
    const cloud = attachEarthClouds(mesh);
    rec.overlays.push(cloud);
    if (cloud.material.uniforms?.uTime) animatedMaterials.push(cloud.material);
  }

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
let followedId = null;     // body the camera is currently following (dblclick to pin, ESC to release)
let editingId = null;      // body in EDIT mode — halo shown, Delete + drag-resize active.
                            // Entered by clicking a body that's already followed.

createSelectionRaycaster({
  camera, domElement: renderer.domElement,
  getRecords: () => records,
  onSelect: (rec) => {
    if (selected) selected.selected = false;
    selected = rec;
    if (selected) selected.selected = true;
    if (!selected) props.update(null);
    // Enter EDIT mode only when the clicked body is already the followed one.
    // Otherwise exit edit mode (clicking elsewhere ends editing).
    editingId = (rec && rec.id === followedId) ? rec.id : null;
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

// Click + drag the body in EDIT mode to resize (mass scales as r³). Stars past 8 M☉ supernova.
// You're in edit mode only after double-clicking a body (to pin it) and then clicking it again.
createDragResize({
  camera, domElement: renderer.domElement, cameraControls: cam,
  getRecords: () => records,
  getSelected: () => editingId ? records.find(r => r.id === editingId) : null,
  engine,
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
  if (editingId === id) editingId = null;
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

createResetPresets({ onPreset: loadPreset });

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
  // Double-click PINS the camera but does NOT enter edit mode — that takes a subsequent click.
  if (rec) { cam.follow(() => rec.object.position); followedId = rec.id; editingId = null; }
  else { cam.release(); followedId = null; editingId = null; }
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
    editingId = null;
    if (selected) { selected.selected = false; selected = null; props.update(null); }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && editingId) {
    // Don't fire while typing in the sidebar search.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    destroyBody(editingId);
  }
});

const _projPos = new Vector3();
function updateEditHalo(rec) {
  _projPos.copy(rec.object.position).project(camera);
  // Hide when behind the camera (z >= 1 in clip-space).
  if (_projPos.z >= 1) { editHalo.style.display = 'none'; return; }

  const cx = (_projPos.x + 1) * 0.5 * innerWidth;
  const cy = (-_projPos.y + 1) * 0.5 * innerHeight;

  // Effective rendered world-space radius of this body.
  // Placeholder spheres have geometry-radius 1, so scale.x is the radius.
  // After LOD swap, the GLB is bbox-normalized so that scale = _baseScale gives the rendered
  // diameter = sceneScale * 2. Any extra factor (scale.x / _baseScale) is the user's resize
  // multiplier, so the current effective radius is sceneScale * (scale.x / _baseScale).
  const base = rec._baseScale || rec.sceneScale || 1;
  const sizeMult = (rec.object.scale.x / base) || 1;
  const worldRadius = (rec.sceneScale || 1) * sizeMult;

  // Pinhole-projection screen radius (works correctly regardless of camera orientation).
  // For a perspective camera: screenR = (worldRadius / distance) * focalLengthPixels,
  // where focalLengthPixels = (height/2) / tan(fov/2).
  const dist = camera.position.distanceTo(rec.object.position);
  if (dist <= 0) { editHalo.style.display = 'none'; return; }
  const fovRad = camera.fov * Math.PI / 180;
  const focal = (innerHeight / 2) / Math.tan(fovRad / 2);
  const screenR = Math.max(4, (worldRadius / dist) * focal);

  const pad = 4;
  const total = screenR * 2 + pad * 2;
  editHalo.style.left = (cx - screenR - pad) + 'px';
  editHalo.style.top  = (cy - screenR - pad) + 'px';
  editHalo.style.width = total + 'px';
  editHalo.style.height = total + 'px';
  editHalo.style.display = 'block';
}

// Stage 4 postprocessing pipeline:
//   - Selective bloom (only the BLOOM_LAYER renders into the bloom pass; stars glow, planets don't)
//   - Lensing pass (screen-space UV warp around any black-hole bodies; runs after bloom mix)
const lensing = createLensingPass({
  camera,
  getBlackHoles: () => records.filter(r => r.body?.procedural === 'black_hole'),
});
const composer = createSelectiveBloom({ renderer, scene, camera, extraPass: lensing.pass });

// Resize: scene's existing handler updates the renderer; also resize the composer's targets.
window.addEventListener('resize', () => {
  composer.setSize(innerWidth, innerHeight);
});

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

  // Update animated shader uniforms (uTime) for stars / nebulae / clouds — real time, not
  // sim time, so the visuals stay alive even when the simulation is paused.
  const realT = now / 1000;
  for (const m of animatedMaterials) {
    if (m.uniforms?.uTime) m.uniforms.uTime.value = realT;
  }

  // Edit-mode HTML halo: project the body's bounding sphere to screen space, draw a blue
  // circle around it (like a Google-Slides selection border).
  if (editingId) {
    const rec = records.find(r => r.id === editingId);
    if (!rec) { editingId = null; editHalo.style.display = 'none'; }
    else updateEditHalo(rec);
  } else {
    editHalo.style.display = 'none';
  }

  if (selected) {
    const s = engine.getState(selected.id);
    if (s) props.update({ body: selected.body, state: s, lod: selected.currentLod });
  }

  // Update lensing uniforms with current black-hole screen positions, then render via the
  // selective-bloom composer (which also runs the lensing pass at the end).
  lensing.update();
  composer.render();
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
