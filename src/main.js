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
