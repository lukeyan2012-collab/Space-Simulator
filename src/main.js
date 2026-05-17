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
import { createResetPresets } from '@/ui/reset-presets.js';
import { createSizeSlider } from '@/ui/size-slider.js';
import { createGhost } from '@/interaction/ghost-spawn.js';
import { createGhostPanel } from '@/ui/ghost-panel.js';
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
  // Nebulae are diffuse clouds, not bodies — render them much larger than the power-law gives
  // so the volumetric shader has room to look 3D.
  if (spec.procedural === 'nebula') {
    return Math.max(18, EARTH_RENDER_R * Math.pow(r, RADIUS_EXP) * 2.5);
  }
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
  // Apply axial tilt once at spawn (e.g. Uranus 97.77° → spins on its side).
  // Subsequent spin() uses local-Y rotation, so it composes with this tilt.
  if (spec.axialTilt_deg) mesh.rotateZ(spec.axialTilt_deg * Math.PI / 180);
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
let prevTimeValue = 0.5;   // remembered slider value so spacebar can toggle pause cleanly

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

// Categories that use the ghost-configure flow on drop. Everything else (Nebulae, Star
// Remnants, Satellites) places immediately using the auto-computed default velocity.
const GHOST_CATEGORIES = new Set(['Stars', 'Planets', 'Moons', 'Asteroids']);

let ghost = null;
const ghostPanel = createGhostPanel({
  onSize:   (v) => ghost?.setSize(v),
  onSpin:   (v) => ghost?.setSpin(v),
  onSpeed:  (v) => ghost?.setSpeed(v),
  onCancel: () => cancelGhost(),
  onInsert: () => commitGhost(),
});
function cancelGhost() {
  if (!ghost) return;
  ghost.destroy();
  ghost = null;
  ghostPanel.hide();
}
function commitGhost() {
  if (!ghost) return;
  const c = ghost.getCommit();
  const rec = spawnFromManifest(c.spec, c.position, c.velocity);
  if (rec) {
    const base = rec._baseScale || rec.sceneScale || 1;
    rec.object.scale.setScalar(base * c.sizeMult);
    rec._spinMult = c.spinMult;
    if (c.sizeMult !== 1) {
      const newMass = rec.body.realMass_kg * c.sizeMult * c.sizeMult * c.sizeMult;
      engine.setState(rec.id, { mass: newMass });
    }
  }
  ghost.destroy();
  ghost = null;
  ghostPanel.hide();
}

const dragDrop = createDragDrop({
  scene, camera, domElement: renderer.domElement, manifest,
  getRecords: () => records,
  getCamTarget: () => cam.target,
  onDrop: (body, positionScene, defaultVelocityMs) => {
    if (!GHOST_CATEGORIES.has(body.category)) {
      // Non-{Stars/Planets/Moons/Asteroids} → place immediately, no ghost.
      const positionM = positionScene.map(p => p / DISTANCE_SCALE);
      spawnFromManifest(body, positionM, defaultVelocityMs);
      return;
    }
    // Open the ghost configurator with default direction taken from the orbital velocity.
    cancelGhost();
    const r = visibleRadius(body);
    const speed = Math.hypot(defaultVelocityMs[0], defaultVelocityMs[1], defaultVelocityMs[2]);
    const defaultDir = speed > 0
      ? new Vector3(defaultVelocityMs[0] / speed, defaultVelocityMs[1] / speed, defaultVelocityMs[2] / speed)
      : null;
    ghost = createGhost({
      spec: body, position: positionScene, scene, baseRadius: r,
      defaultSpeed: speed || 10000,
      defaultDirection: defaultDir,
    });
    ghostPanel.show(body.displayName, { size: 1, spin: 1, speed: speed || 10000 });
  },
});
createSidebar({
  manifest,
  onDragStart: (id) => dragDrop.beginDragFromSidebar(id),
  onTapAdd: (id) => dragDrop.armForTapAdd(id),
});

// Top-center "Adjust size" slider — appears whenever a body is double-click-pinned. Drag it
// to rescale the focused body. Mass scales as r³ (volume-proportional). Stars exceeding 8 M☉
// trigger the supernova chain automatically.
const sizeSlider = createSizeSlider({
  onSize: (mult) => {
    if (!followedId) return;
    const rec = records.find(r => r.id === followedId);
    if (!rec) return;
    const base = rec._baseScale || rec.sceneScale || 1;
    rec.object.scale.setScalar(base * mult);
    const newMass = rec.body.realMass_kg * mult * mult * mult;
    engine.setState(rec.id, { mass: newMass });
    // Auto-supernova when a star is scaled past the 8 M☉ threshold.
    if (rec.body.category === 'Stars' && newMass > 8 * 1.989e30) {
      goSupernova(rec, newMass);
    }
  },
});

function currentSizeMult(rec) {
  const base = rec._baseScale || rec.sceneScale || 1;
  return (rec.object.scale.x / base) || 1;
}

// Anything that gravitationally absorbs other bodies on contact.
function isAbsorber(body) {
  return body?.procedural === 'star'
      || body?.procedural === 'black_hole'
      || body?.procedural === 'neutron_star'
      || body?.procedural === 'white_dwarf';
}

const TRAP_DURATION_MS = 3000;

// Start a 3-second absorption animation: lerp the body toward the absorber, shrink to zero,
// spin faster as it falls in, then destroy. Visual only — engine mass set to ~0 so the
// trapped body doesn't perturb anything else while it's being sucked in.
function trapBody(rec, absorber) {
  if (rec._trapping) return;
  rec._trapping = {
    absorber,
    start: performance.now(),
    startPos: rec.object.position.clone(),
    startScale: rec.object.scale.x,
  };
  engine.setState(rec.id, { velocity: [0, 0, 0], mass: 0.01 });
  // If the camera was following the doomed body, release so the view doesn't pull into the absorber.
  if (followedId === rec.id) { cam.release(); followedId = null; sizeSlider.hide(); }
}

// Capture distance multipliers. The verlet integrator already does real Newtonian gravity,
// so most flybys naturally slingshot (high tangential velocity) or spiral in (low energy).
// Capture only happens when the body literally crosses the absorber's mesh boundary — once
// past that point we hijack motion and animate the body to the center over 3 seconds, then
// despawn it. A body with enough velocity at periapsis can still escape — gravity decides.
const STAR_CAPTURE_MULT = 1.0;
const BH_CAPTURE_MULT   = 1.0;

// Scan for non-absorber bodies overlapping any absorber and start the trap animation.
function checkAbsorptions() {
  const absorbers = records.filter(r => isAbsorber(r.body));
  if (!absorbers.length) return;
  for (const rec of records) {
    if (rec._trapping) continue;
    if (isAbsorber(rec.body)) continue;
    for (const ab of absorbers) {
      const dx = rec.object.position.x - ab.object.position.x;
      const dy = rec.object.position.y - ab.object.position.y;
      const dz = rec.object.position.z - ab.object.position.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      const mult = ab.body.procedural === 'black_hole' ? BH_CAPTURE_MULT : STAR_CAPTURE_MULT;
      const rsum = rec.object.scale.x + ab.object.scale.x * mult;
      if (d2 < rsum * rsum) { trapBody(rec, ab); break; }
    }
  }
}

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
    sizeSlider.hide();
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
  sizeSlider.hide();
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

// Smart-focus: pin the camera to a body and re-zoom so it fills ~28% of screen height.
// If the camera is already comfortably framed (within 0.4×..2.5× of the desired distance),
// don't move it — just pin. Direction from camera to body is preserved so we don't disorient.
const FOCUS_FRACTION = 0.28; // target body diameter as a fraction of screen height
function smartFocus(rec) {
  const fovRad = camera.fov * Math.PI / 180;
  const worldR = (rec.sceneScale || 1) * currentSizeMult(rec);
  const desiredDist = worldR / (FOCUS_FRACTION * Math.tan(fovRad / 2));

  const offset = new Vector3().subVectors(camera.position, rec.object.position);
  const currentDist = offset.length() || 1;
  if (currentDist < desiredDist * 0.4 || currentDist > desiredDist * 2.5) {
    offset.normalize().multiplyScalar(desiredDist);
    camera.position.copy(rec.object.position).add(offset);
  }
  cam.follow(() => rec.object.position);
  followedId = rec.id;
  sizeSlider.show(currentSizeMult(rec), rec.body.displayName);
}

// Arrow-drag direction setter for the ghost. While a ghost is open, pressing on the canvas
// over (or near) the ghost engages a drag that rotates the launch arrow to point at the
// dragged cursor position projected onto a sphere around the ghost center. OrbitControls is
// disabled during the drag so the camera doesn't fight the user.
const arrowRay = new Raycaster();
const arrowNdc = new Vector2();
let arrowDrag = null; // { prevControlsEnabled }
function ndcOfEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  arrowNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  arrowNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  arrowRay.setFromCamera(arrowNdc, camera);
  return arrowRay;
}
function pointToDirection(e) {
  if (!ghost) return null;
  const r = ndcOfEvent(e);
  const center = ghost.mesh.position;
  // First try a sphere around the ghost (preferred — drag-on-surface feel).
  const sphereR = (ghost.mesh.scale.x || 1) * 1.3;
  const out = new Vector3();
  // Three.js Ray.intersectSphere needs a Sphere instance; construct inline.
  // Use the simpler closed-form: solve | (origin + t * dir) - center |^2 = r^2.
  const o = r.ray.origin, d = r.ray.direction;
  const oc = new Vector3().subVectors(o, center);
  const b = oc.dot(d);
  const c = oc.dot(oc) - sphereR * sphereR;
  const disc = b * b - c;
  if (disc >= 0) {
    const t = -b - Math.sqrt(disc); // near intersection
    if (t > 0) {
      out.copy(d).multiplyScalar(t).add(o);
      return out.sub(center);
    }
  }
  // Fallback: project pointer onto a camera-facing plane through ghost center.
  const planeNormal = camera.getWorldDirection(new Vector3()).negate();
  const denom = planeNormal.dot(d);
  if (Math.abs(denom) < 1e-6) return null;
  const t2 = planeNormal.dot(new Vector3().subVectors(center, o)) / denom;
  if (t2 <= 0) return null;
  out.copy(d).multiplyScalar(t2).add(o);
  return out.sub(center);
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!ghost || e.button !== 0) return;
  // Engage drag if pointer is near the ghost — generous radius for usability.
  const r = ndcOfEvent(e);
  const center = ghost.mesh.position;
  const grabR = (ghost.mesh.scale.x || 1) * 2.5;
  const o = r.ray.origin, d = r.ray.direction;
  const oc = new Vector3().subVectors(o, center);
  const b = oc.dot(d);
  const c = oc.dot(oc) - grabR * grabR;
  if (b * b - c < 0) return; // ray doesn't pass close to ghost — let OrbitControls handle it
  e.stopImmediatePropagation();
  arrowDrag = { prevControlsEnabled: cam.controls.enabled };
  cam.controls.enabled = false;
  const dir = pointToDirection(e);
  if (dir) ghost.setDirectionFromVector(dir);
}, { capture: true });
window.addEventListener('pointermove', (e) => {
  if (!arrowDrag || !ghost) return;
  const dir = pointToDirection(e);
  if (dir) ghost.setDirectionFromVector(dir);
});
window.addEventListener('pointerup', () => {
  if (!arrowDrag) return;
  cam.controls.enabled = arrowDrag.prevControlsEnabled;
  arrowDrag = null;
});

// Double-click a body → smart focus. Double-click empty → release follow + hide slider.
const ray = new Raycaster();
const ndc = new Vector2();
renderer.domElement.addEventListener('dblclick', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const pickables = records.map(r => r.object);
  const hits = ray.intersectObjects(pickables, true);
  if (!hits.length) { cam.release(); followedId = null; sizeSlider.hide(); return; }
  let n = hits[0].object;
  while (n.parent && !records.some(r => r.object === n)) n = n.parent;
  const rec = records.find(r => r.object === n);
  if (rec) smartFocus(rec);
  else { cam.release(); followedId = null; sizeSlider.hide(); }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (ghost) { cancelGhost(); return; }
    cam.release();
    followedId = null;
    sizeSlider.hide();
    if (selected) { selected.selected = false; selected = null; props.update(null); }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && followedId) {
    // Don't fire while typing in the sidebar search.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    destroyBody(followedId);
  }
  if (e.code === 'Space' || e.key === ' ') {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    if (slider.isPaused) {
      slider.set(prevTimeValue || 0.5);
    } else {
      prevTimeValue = slider.value;
      slider.set(0);
    }
  }
});

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
    if (rec._trapping) continue; // animated separately below
    const s = engine.getState(rec.id); if (!s) continue;
    rec.syncFromEngine(s, camera);
    rec.spin(totalSimSec); // axial rotation; scales with the time-slider, pauses at 0
  }

  // Check for new absorptions (star / black-hole vs anything else). Visual only —
  // the trap animation is in real-time so it plays even when the simulation is paused.
  checkAbsorptions();

  // Animate trapped bodies: lerp inward toward absorber, shrink, spin faster. Destroy at t≥1.
  // Iterate from the end so destroyBody splicing during loop doesn't skip elements.
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    const trap = rec._trapping;
    if (!trap) continue;
    const u = (performance.now() - trap.start) / TRAP_DURATION_MS;
    if (u >= 1) { destroyBody(rec.id); continue; }
    const eased = u * u; // accelerate as it falls in
    rec.object.position.lerpVectors(trap.startPos, trap.absorber.object.position, eased);
    rec.object.scale.setScalar(trap.startScale * (1 - 0.92 * u));
    rec.object.rotateY(0.18 + 0.6 * u); // accelerating spin
    // Keep engine position synced so physics doesn't try to pull the body somewhere else.
    const px = rec.object.position.x / DISTANCE_SCALE;
    const py = rec.object.position.y / DISTANCE_SCALE;
    const pz = rec.object.position.z / DISTANCE_SCALE;
    engine.setState(rec.id, { position: [px, py, pz], velocity: [0, 0, 0] });
  }

  lodRuntime.tick(camera);

  // Update animated shader uniforms (uTime) for stars / nebulae / clouds — real time, not
  // sim time, so the visuals stay alive even when the simulation is paused.
  const realT = now / 1000;
  for (const m of animatedMaterials) {
    if (m.uniforms?.uTime) m.uniforms.uTime.value = realT;
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
