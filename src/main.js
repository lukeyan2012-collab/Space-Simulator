import { createScene } from '@/render/scene.js';
import { createStarfield } from '@/render/starfield.js';
import { createCameraController } from '@/interaction/camera-controls.js';
import { createLoadingScreen } from '@/ui/loading-screen.js';
import { createTimeSlider } from '@/ui/time-slider.js';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import {
  G, DISTANCE_SCALE, TIME_BASE_SECONDS_PER_REAL_SECOND, MAX_SUBSTEPS_PER_FRAME,
} from '@/physics/constants.js';
import { Mesh, SphereGeometry, MeshBasicMaterial, Raycaster, Vector2 } from 'three';

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
// Orbit in the XZ plane (ecliptic): Earth sweeps "horizontally" around the Sun
// from the default camera angle, instead of bobbing up and down.
engine.addBody({ id: 'earth', mass: M_EARTH, position: [AU,0,0], velocity: [0, 0, -Math.sqrt(G*M_SUN/AU)] });

// Visual radii are exaggerated for the Stage 1 demo — Earth at physical scale would be sub-pixel
// at 1 AU separation. Stage 2 replaces these with manifest-driven log-scaled placeholders + GLBs.
const sun = new Mesh(new SphereGeometry(4.0, 32, 32), new MeshBasicMaterial({ color: 0xffaa33 }));
const earth = new Mesh(new SphereGeometry(2.0, 24, 24), new MeshBasicMaterial({ color: 0x6aa9ff }));
sun.userData.bodyId = 'sun';
earth.userData.bodyId = 'earth';
const pickables = [sun, earth];
scene.add(sun, earth);

// Click on a body → camera follows it; click empty space → release (free pan with right-click).
const ray = new Raycaster();
const ndc = new Vector2();
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // left button only
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (hit) cam.follow(() => hit.object.position);
  else cam.release();
});

const slider = createTimeSlider({ initial: 0.75 }); // 0.75 → 10× — visible orbit in ~36s

function syncMesh(mesh, id) {
  const s = engine.getState(id); if (!s) return;
  mesh.position.set(s.position[0]*DISTANCE_SCALE, s.position[1]*DISTANCE_SCALE, s.position[2]*DISTANCE_SCALE);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cam.release(); });

// Reset View button — restores camera to initial position + target, releases follow.
const resetBtn = document.createElement('button');
resetBtn.className = 'reset-view-btn';
resetBtn.textContent = 'Reset View';
resetBtn.title = 'Restore default camera (also: ESC releases follow)';
resetBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't trigger canvas pick
resetBtn.addEventListener('click', () => cam.resetView());
document.getElementById('ui-root').appendChild(resetBtn);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  cam.update(dt);

  if (!slider.isPaused) {
    const totalSimSec = slider.multiplier * TIME_BASE_SECONDS_PER_REAL_SECOND * dt;
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
