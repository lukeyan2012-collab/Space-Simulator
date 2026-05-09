import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Sphere, Vector3 } from 'three';
import { createFrustumHelper } from '@/lod/frustum-helper.js';

describe('frustum helper', () => {
  it('returns true for a sphere at the camera target and false for one behind', () => {
    const cam = new PerspectiveCamera(60, 1, 0.1, 1000);
    cam.position.set(0,0,10); cam.lookAt(0,0,0); cam.updateMatrixWorld();
    const fh = createFrustumHelper();
    fh.update(cam);
    expect(fh.intersectsSphere(new Sphere(new Vector3(0,0,0), 1))).toBe(true);
    expect(fh.intersectsSphere(new Sphere(new Vector3(0,0,100), 1))).toBe(false);
  });
});
