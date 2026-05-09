import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const FOCUS_LERP = 6.0; // higher = snappier
const STOP_EPS = 0.05;

export function createCameraController(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1;
  controls.maxDistance = 5000;

  let focusTarget = null;
  const tmpDest = new Vector3();

  function focus(vec3) { focusTarget = vec3.clone(); }
  function clearFocus() { focusTarget = new Vector3(0, 0, 0); }

  function update(dt) {
    if (focusTarget) {
      tmpDest.copy(focusTarget);
      controls.target.lerp(tmpDest, Math.min(1, FOCUS_LERP * dt));
      if (controls.target.distanceTo(tmpDest) < STOP_EPS) controls.target.copy(tmpDest);
    }
    controls.update();
  }

  return { controls, focus, clearFocus, update, get target() { return controls.target; } };
}
