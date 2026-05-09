import { createScene } from '@/render/scene.js';
import { createStarfield } from '@/render/starfield.js';
import { createCameraController } from '@/interaction/camera-controls.js';
import { createLoadingScreen } from '@/ui/loading-screen.js';
import { createTimeSlider } from '@/ui/time-slider.js';
import { createPropertiesPanel } from '@/ui/properties-panel.js';
import { createHoverCard } from '@/ui/hover-card.js';
import { createSelectionRaycaster } from '@/interaction/raycaster.js';
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

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, { width: innerWidth, height: innerHeight });
scene.add(createStarfield());

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
const modelLoader = createModelLoader({ basePath: '/models/', manager: orch.manager });

const engine = createVerletEngine();
const records = [];

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
  return rec;
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
