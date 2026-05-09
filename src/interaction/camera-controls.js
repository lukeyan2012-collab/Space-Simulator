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

  let focusTarget = null;     // one-shot lerp to a static point
  let followGetter = null;    // continuous: follow a moving body each frame
  const tmpDest = new Vector3();

  // snapshot of the initial pose for resetView()
  const initialCameraPos = camera.position.clone();
  const initialTarget = controls.target.clone();

  function focus(vec3) { focusTarget = vec3.clone(); followGetter = null; }
  function follow(getterFn) { followGetter = getterFn; focusTarget = null; }
  function release() { followGetter = null; focusTarget = null; }
  function clearFocus() { release(); }

  function resetView() {
    release();
    camera.position.copy(initialCameraPos);
    controls.target.copy(initialTarget);
    controls.update();
  }

  function update(dt) {
    if (followGetter) {
      const pos = followGetter();
      if (pos) {
        tmpDest.copy(pos);
        controls.target.lerp(tmpDest, Math.min(1, FOCUS_LERP * dt));
      }
    } else if (focusTarget) {
      tmpDest.copy(focusTarget);
      controls.target.lerp(tmpDest, Math.min(1, FOCUS_LERP * dt));
      if (controls.target.distanceTo(tmpDest) < STOP_EPS) {
        controls.target.copy(tmpDest);
        focusTarget = null;
      }
    }
    controls.update();
  }

  return {
    controls, focus, follow, release, clearFocus, resetView, update,
    get target() { return controls.target; },
    get isFollowing() { return followGetter != null; },
  };
}
