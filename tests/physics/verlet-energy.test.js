import { describe, it, expect } from 'vitest';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import { G } from '@/physics/constants.js';

function totalEnergy(bodies) {
  let ke = 0, pe = 0;
  for (const b of bodies) {
    const v2 = b.velocity[0]**2 + b.velocity[1]**2 + b.velocity[2]**2;
    ke += 0.5 * b.mass * v2;
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[i].position[0] - bodies[j].position[0];
      const dy = bodies[i].position[1] - bodies[j].position[1];
      const dz = bodies[i].position[2] - bodies[j].position[2];
      const r = Math.sqrt(dx*dx + dy*dy + dz*dz);
      pe -= G * bodies[i].mass * bodies[j].mass / r;
    }
  }
  return ke + pe;
}

describe('verlet engine — energy drift', () => {
  it('conserves total energy within 1% over 100 days', () => {
    const M_SUN = 1.989e30;
    const M_EARTH = 5.972e24;
    const AU = 1.496e11;
    const v = Math.sqrt(G * M_SUN / AU);
    const e = createVerletEngine();
    e.addBody({ id: 'sun',   mass: M_SUN,   position: [0,0,0],  velocity: [0,0,0] });
    e.addBody({ id: 'earth', mass: M_EARTH, position: [AU,0,0], velocity: [0,v,0] });

    const E0 = totalEnergy(e.all());
    const stepSec = 3600;
    for (let i = 0; i < 24 * 100; i++) e.step(stepSec);
    const E1 = totalEnergy(e.all());
    expect(Math.abs((E1 - E0) / E0)).toBeLessThan(0.01);
  });
});
