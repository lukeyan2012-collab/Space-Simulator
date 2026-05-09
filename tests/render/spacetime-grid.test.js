import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { createSpacetimeGrid } from '@/render/spacetime-grid.js';

function fakeRecord(id, mass, x, y, z) {
  return { id, body: { realMass_kg: mass }, object: { position: new Vector3(x, y, z) } };
}

describe('spacetime grid', () => {
  it('starts hidden', () => {
    const sg = createSpacetimeGrid();
    expect(sg.mesh.visible).toBe(false);
  });

  it('setMode("grid") shows the mesh and sets warp 0', () => {
    const sg = createSpacetimeGrid();
    sg.setMode('grid');
    expect(sg.mesh.visible).toBe(true);
    expect(sg.mesh.material.uniforms.uWarpAmount.value).toBe(0);
  });

  it('setMode("warp") shows the mesh and sets warp 1', () => {
    const sg = createSpacetimeGrid();
    sg.setMode('warp');
    expect(sg.mesh.visible).toBe(true);
    expect(sg.mesh.material.uniforms.uWarpAmount.value).toBe(1);
  });

  it('setMode("stars" / anything else) hides the mesh', () => {
    const sg = createSpacetimeGrid();
    sg.setMode('warp');
    sg.setMode('stars');
    expect(sg.mesh.visible).toBe(false);
  });

  it('updateBodies copies positions and a log-mass into uniforms', () => {
    const sg = createSpacetimeGrid();
    sg.updateBodies([
      fakeRecord('sun', 1.989e30, 0, 0, 0),
      fakeRecord('earth', 5.972e24, 150, 0, 0),
    ]);
    const positions = sg.mesh.material.uniforms.uBodyPositions.value;
    const masses = sg.mesh.material.uniforms.uBodyMasses.value;
    expect(sg.mesh.material.uniforms.uBodyCount.value).toBe(2);
    expect(positions[0]).toBe(0);
    expect(positions[3]).toBe(150);
    // Sun mass log10(1 + 1.989e30/1e22)*0.5 ≈ 4.15
    expect(masses[0]).toBeGreaterThan(3);
    expect(masses[0]).toBeLessThan(5);
    // Earth's normalized "warp mass" is much smaller than the Sun's
    expect(masses[1]).toBeLessThan(masses[0]);
  });
});
