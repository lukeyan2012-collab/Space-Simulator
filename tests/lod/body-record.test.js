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

  it('spin rotates the mesh proportionally to deltaSimSec / period; null period is a no-op', () => {
    const mesh = new Mesh(new SphereGeometry(1, 8, 8), new MeshBasicMaterial());
    const rec = createBodyRecord({ ...fakeBody, rotationPeriod_s: 100 }, mesh, 1);
    // Spin uses an internal SPIN_VIS_MULT (0.18) so the visual rotation rate isn't blurry at
    // fast time scales. We just check the rotation is correctly proportional and direction is
    // around the +Y axis (probe vector starting at +X moves toward -Z for positive rotation).
    rec.spin(50);
    const probe = new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
    expect(probe.x).toBeLessThan(1);   // moved away from initial +X
    expect(probe.x).toBeGreaterThan(0); // not fully past π/2
    expect(probe.z).toBeLessThan(0);   // rotated toward -Z
    expect(probe.y).toBeCloseTo(0, 6); // stayed in XZ plane (around Y)

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
