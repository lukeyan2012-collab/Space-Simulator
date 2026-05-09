import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { circularOrbitVelocity } from '@/interaction/drag-drop.js';
import { G } from '@/physics/constants.js';

describe('circularOrbitVelocity', () => {
  it('produces v = sqrt(GM/r) tangent to up vector', () => {
    const center = new Vector3(0,0,0);
    const point = new Vector3(1.5e11, 0, 0); // 1 AU
    const up = new Vector3(0,1,0);
    const v = circularOrbitVelocity(point, center, 1.989e30, up);
    const expected = Math.sqrt(G * 1.989e30 / 1.5e11);
    expect(Math.abs(v.length() - expected) / expected).toBeLessThan(0.01);
    expect(Math.abs(v.x)).toBeLessThan(1); // perpendicular to radial
  });
});
