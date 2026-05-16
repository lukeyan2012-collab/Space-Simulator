import { Box3, Vector3 } from 'three';
import { createLodManager } from './lod-manager.js';
import { createFrustumHelper } from './frustum-helper.js';

// Screen-space LOD threshold (in pixels): the body's projected diameter in pixels is what we
// use to pick high vs low. Pixel-space is more stable than world-distance because it accounts
// for FOV and viewport size. Hysteresis band is wide (40 → 200) so swaps need a clear signal.
const PX_UPGRADE   = 200; // diameter ≥ this → high LOD
const PX_DOWNGRADE = 40;  // diameter ≤ this → low LOD
                          // anything between → keep current LOD (no swap)

function screenPixelDiameter(rec, camera) {
  const dist = camera.position.distanceTo(rec.object.position);
  if (dist <= 1e-3) return Infinity;
  const fovRad = camera.fov * Math.PI / 180;
  const focal = (window.innerHeight / 2) / Math.tan(fovRad / 2);
  // Use sceneScale (NOT scale.x), so a user drag-resize doesn't move the LOD threshold —
  // LOD is decided by the body's intrinsic visual size, not the user's resize multiplier.
  const worldR = rec.sceneScale || 1;
  return (worldR / dist) * focal * 2;
}

export function createLodRuntime({ records, modelLoader, scene }) {
  // The manager handles priority/budget/visibility. We map pixel-diameter → its "distance"
  // input so the existing manager API works: bigger pixels = smaller "distance" = higher
  // priority + tripping the upgrade threshold.
  // Manager thresholds in "distance" units: upgrade if dist < UP, downgrade if dist > DOWN.
  // We translate from pixels using distance = MAP / pixels; then UP/DOWN below pin to the
  // pixel thresholds above.
  const MAP = 10000;
  const manager = createLodManager({
    highBudget: 3,
    upgradeAt: MAP / PX_UPGRADE,   // ~50 in distance units → equiv to ≥ 200 px diameter
    downgradeAt: MAP / PX_DOWNGRADE,// ~250 in distance units → equiv to ≤ 40 px diameter
  });
  const frustum = createFrustumHelper();
  const inflightSwap = new Set(); // ids currently mid-swap, prevent double-swap

  async function setLod(rec, target) {
    if (rec.currentLod === target) return;
    if (rec.body.procedural) { rec.currentLod = target; return; }
    if (inflightSwap.has(rec.id)) return;
    inflightSwap.add(rec.id);
    try {
      const obj = await modelLoader.load(rec.body.assetName, target);
      if (!obj) { rec.currentLod = target; return; } // miss-cache will keep us on placeholder
      const newMesh = obj.clone(true);

      // Normalize GLB size so the rendered radius matches rec.sceneScale, regardless of the
      // GLB's natural authoring size. (Sketchfab Earth, for instance, has intermediate node
      // transforms that make the unit-radius mesh render as a giant sphere if not normalized.)
      newMesh.scale.set(1, 1, 1);
      newMesh.updateMatrixWorld(true);
      const box = new Box3().setFromObject(newMesh);
      const size = box.getSize(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetDiameter = rec.sceneScale * 2;
      const normScale = maxDim > 0 ? targetDiameter / maxDim : 1;
      // preserve the global visual-size multiplier across the LOD swap, if main.js has applied one.
      const sizeMult = (rec.object.scale.x / (rec._baseScale || 1)) || 1;
      rec._baseScale = normScale;
      newMesh.scale.setScalar(normScale * sizeMult);

      newMesh.position.copy(rec.object.position);
      newMesh.userData.bodyId = rec.id; // preserve pickability

      // Detach any procedural overlays (rings/clouds) before disposing the old mesh, then
      // re-attach them as children of the new one so they ride along through LOD changes.
      const overlays = (rec.overlays || []).slice();
      for (const ov of overlays) rec.object.remove(ov);

      scene.add(newMesh);
      scene.remove(rec.object);
      modelLoader.dispose(rec.object);
      rec.object = newMesh;
      rec.currentLod = target;

      for (const ov of overlays) newMesh.add(ov);
      rec.overlays = overlays;
    } finally {
      inflightSwap.delete(rec.id);
    }
  }

  function tick(camera) {
    frustum.update(camera);
    const list = records.map(r => {
      const px = screenPixelDiameter(r, camera);
      return {
        id: r.id,
        distance: MAP / Math.max(0.1, px), // smaller = bigger on screen = more important
        visible: frustum.intersectsSphere(r.boundingSphere),
        selected: r.selected,
        hovered: r.hovered,
      };
    });
    const decisions = manager.decide(list);
    for (const d of decisions) {
      const r = records.find(rr => rr.id === d.id);
      if (r) setLod(r, d.lod);
    }
  }

  return { tick };
}
