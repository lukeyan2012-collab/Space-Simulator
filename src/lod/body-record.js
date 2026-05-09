import { Mesh, SphereGeometry, MeshBasicMaterial, Color, Sphere, Vector3 } from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

export function makePlaceholder(body) {
  const g = new SphereGeometry(1, 16, 16);
  // Unlit material so bodies are visible without scene lighting.
  const m = new MeshBasicMaterial({ color: new Color(body.defaultColor) });
  return new Mesh(g, m);
}

export function createBodyRecord(body, mesh, sceneScale) {
  return {
    id: body.id,
    body,
    object: mesh,
    currentLod: 'low',
    selected: false,
    hovered: false,
    sceneScale,
    boundingSphere: new Sphere(new Vector3(), Math.max(1, sceneScale)),
    _distance: Infinity,
    syncFromEngine(engineState, camera) {
      const p = engineState.position;
      this.object.position.set(p[0]*DISTANCE_SCALE, p[1]*DISTANCE_SCALE, p[2]*DISTANCE_SCALE);
      this.boundingSphere.center.copy(this.object.position);
      this.boundingSphere.radius = Math.max(1, this.sceneScale);
      this._distance = this.object.position.distanceTo(camera.position);
    },
  };
}
