import { describe, it, expect } from 'vitest';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import { G, SEC_PER_DAY } from '@/physics/constants.js';

// Earth around Sun: 1 AU, 30 km/s tangential. After 1 year position should be near origin.
describe('verlet engine — Earth-Sun two-body', () => {
  it('keeps Earth within 5% of 1 AU after 1 year', () => {
    const M_SUN = 1.989e30;
    const M_EARTH = 5.972e24;
    const AU = 1.496e11;
    const v = Math.sqrt(G * M_SUN / AU); // ~29.78 km/s
    const e = createVerletEngine();
    e.addBody({ id: 'sun',   mass: M_SUN,   position: [0,0,0],  velocity: [0,0,0] });
    e.addBody({ id: 'earth', mass: M_EARTH, position: [AU,0,0], velocity: [0,v,0] });

    const stepSec = 3600; // 1h
    const totalSec = 365.25 * SEC_PER_DAY;
    const N = Math.round(totalSec / stepSec);
    for (let i = 0; i < N; i++) e.step(stepSec);

    const pos = e.getState('earth').position;
    const r = Math.hypot(pos[0], pos[1], pos[2]);
    expect(Math.abs(r - AU) / AU).toBeLessThan(0.05);
  });
});
