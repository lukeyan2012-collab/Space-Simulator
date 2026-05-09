import { Box3, Vector3 } from 'three';
import { createLodManager } from './lod-manager.js';
import { createFrustumHelper } from './frustum-helper.js';

export function createLodRuntime({ records, modelLoader, scene }) {
  const manager = createLodManager();
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
      newMesh.scale.setScalar(normScale);

      newMesh.position.copy(rec.object.position);
      newMesh.userData.bodyId = rec.id; // preserve pickability
      scene.add(newMesh);
      scene.remove(rec.object);
      modelLoader.dispose(rec.object);
      rec.object = newMesh;
      rec.currentLod = target;
    } finally {
      inflightSwap.delete(rec.id);
    }
  }

  function tick(camera) {
    frustum.update(camera);
    const list = records.map(r => ({
      id: r.id,
      distance: r._distance ?? Infinity,
      visible: frustum.intersectsSphere(r.boundingSphere),
      selected: r.selected,
      hovered: r.hovered,
    }));
    const decisions = manager.decide(list);
    for (const d of decisions) {
      const r = records.find(rr => rr.id === d.id);
      if (r) setLod(r, d.lod);
    }
  }

  return { tick };
}
