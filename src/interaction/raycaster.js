import { Raycaster, Vector2 } from 'three';

// Selection raycaster.
//
// onSelect(rec | null) fires only on a genuine *click* — a primary-button press that ends
// near where it started. A drag (camera-orbit) does NOT fire onSelect, so an empty-space
// drag won't unfocus the currently followed body. Threshold is in CSS pixels.
//
// onHover fires continuously on pointermove.
const DRAG_THRESHOLD_PX = 6;

export function createSelectionRaycaster({ camera, domElement, getRecords, onSelect, onHover }) {
  const ray = new Raycaster();
  const mouse = new Vector2();
  let lastHovered = null;

  function ndcFromEvent(e) {
    const r = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pick(e) {
    ndcFromEvent(e);
    ray.setFromCamera(mouse, camera);
    const records = getRecords();
    const objects = records.map(r => r.object);
    const hits = ray.intersectObjects(objects, true);
    if (!hits.length) return null;
    let n = hits[0].object;
    while (n.parent && !records.some(r => r.object === n)) n = n.parent;
    return records.find(r => r.object === n) ?? null;
  }

  // Track the pointerdown that started the current gesture so we can decide on pointerup
  // whether it was a click (small motion → select) or a drag (large motion → ignore).
  let downState = null;
  domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    downState = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  // pointerup needs to be on window so it still fires when the mouse leaves the canvas
  // mid-drag (camera orbits often end with the cursor outside the original element).
  window.addEventListener('pointerup', (e) => {
    if (!downState || e.button !== 0 || e.pointerId !== downState.id) {
      downState = null;
      return;
    }
    const dx = e.clientX - downState.x;
    const dy = e.clientY - downState.y;
    const moved = Math.hypot(dx, dy);
    downState = null;
    if (moved > DRAG_THRESHOLD_PX) return; // drag, not a click
    // Make sure the pointerup landed on (or above) our canvas before treating as a click.
    if (e.target !== domElement) return;
    onSelect(pick(e));
  });

  domElement.addEventListener('pointermove', (e) => {
    const rec = pick(e);
    if (rec !== lastHovered) {
      const prev = lastHovered;
      lastHovered = rec;
      onHover(rec, prev);
    }
  });

  return {};
}
