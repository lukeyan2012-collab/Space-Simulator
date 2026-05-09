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
      newMesh.position.copy(rec.object.position);
      newMesh.scale.copy(rec.object.scale);
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
