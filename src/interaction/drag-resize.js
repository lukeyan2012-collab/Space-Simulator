import { Raycaster, Vector2 } from 'three';
import { SUPERNOVA_THRESHOLD_KG } from '@/physics/constants.js';

// Click + drag on a body to resize it. Horizontal drag → scale (right = bigger).
// Mass scales with radius³ (volume-proportional). Stays a uniform sphere.
//
// While dragging, OrbitControls is temporarily disabled so the camera doesn't fight the drag.
// Capture-phase pointerdown lets us suppress OrbitControls' bubble-phase handler when the user
// presses on a body.
//
// onSelect(rec)         - called when a body is hit on pointerdown, so the props panel reflects it.
// onSupernova(rec, m)   - called whenever a Star's effective mass crosses 8 M☉ during a drag.
export function createDragResize({
  camera,
  domElement,
  cameraControls,
  getRecords,
  engine,
  onSelect = () => {},
  onSupernova = () => {},
}) {
  const ray = new Raycaster();
  const ndc = new Vector2();
  let drag = null;

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 12;
  const PIXELS_PER_DOUBLE = 90; // every 90 px of horizontal drag doubles/halves the scale
  const MOVE_THRESHOLD = 4;     // pixels — below this, treat as click (no resize, controls left alone)

  function pick(clientX, clientY) {
    const rect = domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const records = getRecords();
    const hits = ray.intersectObjects(records.map(r => r.object), true);
    if (!hits.length) return null;
    let n = hits[0].object;
    while (n.parent && !records.some(r => r.object === n)) n = n.parent;
    return records.find(r => r.object === n) ?? null;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const rec = pick(e.clientX, e.clientY);
    if (!rec) return;
    // Block OrbitControls from rotating on body-press. We re-enable on pointerup.
    e.stopImmediatePropagation();
    drag = {
      rec,
      startScale: (rec.object.scale.x / (rec._baseScale || 1)) || 1,
      startX: e.clientX,
      startY: e.clientY,
      controlsWasEnabled: cameraControls.controls.enabled,
      moved: false,
    };
    onSelect(rec); // body becomes the selected one immediately
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
    if (!drag.moved) { drag.moved = true; cameraControls.controls.enabled = false; }

    const mult = Math.pow(2, dx / PIXELS_PER_DOUBLE);
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, drag.startScale * mult));
    const base = drag.rec._baseScale || 1;
    drag.rec.object.scale.setScalar(base * newScale);

    // Volume-proportional mass: new = base × scale³
    const originalMass = drag.rec.body.realMass_kg;
    const newMass = originalMass * newScale * newScale * newScale;
    engine.setState(drag.rec.id, { mass: newMass });

    if (newMass > SUPERNOVA_THRESHOLD_KG && drag.rec.body.category === 'Stars') {
      onSupernova(drag.rec, newMass);
      drag = null; // record was just replaced; stop tracking
    }
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.moved) cameraControls.controls.enabled = drag.controlsWasEnabled;
    drag = null;
  }

  domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {};
}
