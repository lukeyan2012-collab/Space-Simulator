import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { attachSaturnRings } from '@/overlays/saturn-rings.js';
import { attachEarthClouds } from '@/overlays/earth-clouds.js';

describe('saturn rings', () => {
  it('attaches as a child of the parent and is a transparent mesh', () => {
    const parent = new Object3D();
    const ring = attachSaturnRings(parent);
    expect(parent.children).toContain(ring);
    expect(ring.isMesh).toBe(true);
    expect(ring.material.transparent).toBe(true);
  });
});

describe('earth clouds', () => {
  it('attaches as a child of the parent at 1.02 unit-relative radius', () => {
    const parent = new Object3D();
    const cloud = attachEarthClouds(parent);
    expect(parent.children).toContain(cloud);
    expect(cloud.geometry.parameters.radius).toBeCloseTo(1.02);
    expect(cloud.material.uniforms.uTime.value).toBe(0);
  });
});
