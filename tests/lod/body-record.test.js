import { describe, it, expect } from 'vitest';
import { Mesh, SphereGeometry, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { makePlaceholder, createBodyRecord } from '@/lod/body-record.js';

const fakeBody = {
  id: 'earth', displayName: 'Earth', category: 'Planets',
  assetName: 'earth', realMass_kg: 5.972e24, realRadius_m: 6.371e6,
  defaultColor: '#3377ff', description: 'home',
};

describe('body record', () => {
  it('starts with currentLod = "placeholder" so the first LOD decision triggers a load', () => {
    // Regression: prior version initialised currentLod to "low", which made the runtime
    // short-circuit on far bodies and never fetch _1k.glb.
    const mesh = new Mesh(new SphereGeometry(1, 8, 8), new MeshBasicMaterial());
    const rec = createBodyRecord(fakeBody, mesh, 3.4);
    expect(rec.currentLod).toBe('placeholder');
  });

  it('makePlaceholder returns a mesh coloured with the body default color', () => {
    const m = makePlaceholder(fakeBody);
    expect(m.isMesh).toBe(true);
    expect('#' + m.material.color.getHexString()).toBe('#3377ff');
  });

  it('spin rotates the mesh by 2π per rotationPeriod_s; null period is a no-op', () => {
    const mesh = new Mesh(new SphereGeometry(1, 8, 8), new MeshBasicMaterial());
    const rec = createBodyRecord({ ...fakeBody, rotationPeriod_s: 100 }, mesh, 1);
    // Verify rotation via a probe vector — Euler.y reads can hit gimbal singularities at π.
    rec.spin(25); // quarter period → π/2 around local Y
    const probe = new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
    expect(probe.z).toBeCloseTo(-1, 5);   // +X → -Z after π/2 around Y
    expect(probe.x).toBeCloseTo(0, 5);

    const noSpinMesh = new Mesh(new SphereGeometry(1, 8, 8), new MeshBasicMaterial());
    const noSpin = createBodyRecord({ ...fakeBody, rotationPeriod_s: null }, noSpinMesh, 1);
    const qBefore = noSpinMesh.quaternion.clone();
    noSpin.spin(99999);
    expect(noSpinMesh.quaternion.equals(qBefore)).toBe(true);
  });

  it('syncFromEngine updates mesh position, bounding sphere, and distance', () => {
    const mesh = new Mesh(new SphereGeometry(1, 8, 8), new MeshBasicMaterial());
    const rec = createBodyRecord(fakeBody, mesh, 3.4);
    const cam = new PerspectiveCamera();
    cam.position.set(0, 0, 0);
    rec.syncFromEngine({ position: [1e10, 0, 0], velocity: [0, 0, 0] }, cam);
    // 1e10 m * 1e-9 = 10 scene units
    expect(mesh.position.x).toBeCloseTo(10, 6);
    expect(rec.boundingSphere.center.x).toBeCloseTo(10, 6);
    expect(rec._distance).toBeCloseTo(10, 6);
  });
});
