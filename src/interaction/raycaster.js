import { Raycaster, Vector2 } from 'three';

// click → onSelect(rec | null). pointermove → onHover(rec | null).
// Uses 'click' (not 'pointerdown') so OrbitControls drag doesn't trigger spurious selects.
// Coexists with main.js's separate 'dblclick' listener for camera pin/unpin.
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

  domElement.addEventListener('click', (e) => {
    if (e.button !== 0) return;
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
