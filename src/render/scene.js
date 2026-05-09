import {
  Scene, PerspectiveCamera, WebGLRenderer, Color,
} from 'three';

export function createScene(canvas, { width, height }) {
  const scene = new Scene();
  scene.background = new Color(0x000005);

  const camera = new PerspectiveCamera(60, width / height, 0.1, 1e9);
  camera.position.set(0, 50, 200);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  return { scene, camera, renderer };
}
