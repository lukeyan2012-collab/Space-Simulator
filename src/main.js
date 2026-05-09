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
