import { createLoadingScreen } from '@/ui/loading-screen.js';
import { createScene } from '@/render/scene.js';
import { createStarfield } from '@/render/starfield.js';
import { createCameraController } from '@/interaction/camera-controls.js';

const loading = createLoadingScreen();
loading.setProgress(0);
// fake progress until we have real loaders
let p = 0;
const sim = setInterval(() => {
  p = Math.min(1, p + 0.05);
  loading.setProgress(p);
  if (p >= 1) { clearInterval(sim); loading.fadeOut(); }
}, 100);

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, {
  width: window.innerWidth,
  height: window.innerHeight,
});
scene.add(createStarfield());

const cam = createCameraController(camera, renderer.domElement);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cam.clearFocus();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  cam.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
