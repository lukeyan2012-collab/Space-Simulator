import { createScene } from '@/render/scene.js';
import { createStarfield } from '@/render/starfield.js';

const canvas = document.getElementById('scene');
const { scene, camera, renderer } = createScene(canvas, {
  width: window.innerWidth,
  height: window.innerHeight,
});
scene.add(createStarfield());

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
