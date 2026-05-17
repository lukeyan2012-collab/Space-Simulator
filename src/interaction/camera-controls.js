import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const FOCUS_LERP = 6.0; // higher = snappier
const STOP_EPS = 0.05;

export function createCameraController(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  // Damping off — no glide after release. Lower rotate/pan speeds for finer pointing
  // control: a given mouse drag covers less arc, so it's easier to settle on a specific
  // view direction without overshooting.
  controls.enableDamping = false;
  controls.rotateSpeed = 0.55;
  controls.panSpeed    = 0.6;
  controls.zoomSpeed   = 0.9;
  controls.minDistance = 1;
  controls.maxDistance = 5000;

  let focusTarget = null;     // one-shot lerp to a static point
  let followGetter = null;    // continuous: follow a moving body each frame
  const tmpDest = new Vector3();
  const tmpDelta = new Vector3();

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
        // Chase-camera: shift the camera by the same delta the body moved this frame, so
        // the camera-to-body offset (and therefore zoom + viewing angle) stays constant
        // as the body orbits. User drag/zoom still works because OrbitControls re-derives
        // its spherical coords from the post-shift camera/target each frame.
        tmpDelta.subVectors(pos, controls.target);
        camera.position.add(tmpDelta);
        controls.target.copy(pos);
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
