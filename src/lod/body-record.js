import { Mesh, SphereGeometry, MeshBasicMaterial, Color, Sphere, Vector3 } from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

export function makePlaceholder(body) {
  const g = new SphereGeometry(1, 16, 16);
  // Unlit material so bodies are visible without scene lighting.
  const m = new MeshBasicMaterial({ color: new Color(body.defaultColor) });
  return new Mesh(g, m);
}

export function createBodyRecord(body, mesh, sceneScale, id = body.id) {
  return {
    id,
    body,
    object: mesh,
    // 'placeholder' = sphere is showing, no GLB loaded yet. First LOD decision will trigger
    // a load even if the target is 'low', so far bodies still get _1k.glb instead of staying as
    // a colored sphere forever.
    currentLod: 'placeholder',
    selected: false,
    hovered: false,
    sceneScale,
    _baseScale: sceneScale,
    boundingSphere: new Sphere(new Vector3(), Math.max(1, sceneScale)),
    _distance: Infinity,
    syncFromEngine(engineState, camera) {
      const p = engineState.position;
      this.object.position.set(p[0]*DISTANCE_SCALE, p[1]*DISTANCE_SCALE, p[2]*DISTANCE_SCALE);
      this.boundingSphere.center.copy(this.object.position);
      this.boundingSphere.radius = Math.max(1, this.sceneScale);
      this._distance = this.object.position.distanceTo(camera.position);
    },
    // Advance axial spin by deltaSimSec simulated seconds. Uses rotateY (rotation around the
    // mesh's LOCAL Y axis) so it composes correctly with an axial tilt applied at spawn time —
    // tilt the body once, then spin around its tilted pole.
    // Multiplied by SPIN_VIS_MULT so spin is visually slower than its real-world rate —
    // otherwise at fast-forward time scales planets become blurry tops.
    // Negative period = retrograde. Null/undefined period = no spin.
    spin(deltaSimSec) {
      const period = this.body.rotationPeriod_s;
      if (!period || !Number.isFinite(period)) return;
      const SPIN_VIS_MULT = 0.18;
      const userMult = this._spinMult ?? 1; // optional per-body override (set by ghost commit)
      this.object.rotateY((deltaSimSec * SPIN_VIS_MULT * userMult / period) * Math.PI * 2);
    },
  };
}
