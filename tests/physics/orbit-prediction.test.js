import { describe, it, expect } from 'vitest';
import { createVerletEngine } from '@/physics/verlet-engine.js';
import { predictOrbit } from '@/physics/orbit-prediction.js';
import { G } from '@/physics/constants.js';

const M_SUN = 1.989e30;
const M_EARTH = 5.972e24;
const AU = 1.496e11;
const R_SUN = 6.957e8;

function sunEngine() {
  const e = createVerletEngine();
  e.addBody({ id: 'sun', mass: M_SUN, position: [0, 0, 0], velocity: [0, 0, 0] });
  return e;
}

describe('orbit prediction', () => {
  it('classifies a circular Earth orbit as a Confirmed orbit', () => {
    const engine = sunEngine();
    const v = Math.sqrt(G * M_SUN / AU);
    const result = predictOrbit({
      engine,
      ghostBody: {
        mass: M_EARTH,
        position: [AU, 0, 0],
        velocity: [0, 0, -v],   // ecliptic-XZ circular orbit, matches main demo
        realRadius_m: 6.371e6,
      },
      otherBodies: [{ id: 'sun', realRadius_m: R_SUN }],
    });
    expect(result.status).toBe('orbit');
    expect(result.attractorId).toBe('sun');
    expect(result.trajectory.length).toBeGreaterThan(50); // sampled across the orbit
  });

  it('classifies a high-speed flyby as an Escape trajectory', () => {
    const engine = sunEngine();
    const v_esc = Math.sqrt(2 * G * M_SUN / AU); // exact escape velocity
    const result = predictOrbit({
      engine,
      ghostBody: {
        mass: M_EARTH,
        position: [AU, 0, 0],
        velocity: [0, 0, -v_esc * 2.0], // well above escape
        realRadius_m: 6.371e6,
      },
      otherBodies: [{ id: 'sun', realRadius_m: R_SUN }],
    });
    expect(result.status).toBe('escape');
  });

  it('classifies a radial fall as a Collision', () => {
    const engine = sunEngine();
    const result = predictOrbit({
      engine,
      ghostBody: {
        mass: M_EARTH,
        position: [AU, 0, 0],
        velocity: [0, 0, 0], // no angular momentum → plunge
        realRadius_m: 6.371e6,
      },
      otherBodies: [{ id: 'sun', realRadius_m: R_SUN }],
    });
    // Either flagged immediately ("radial fall") or detected at impact during stepping.
    expect(['collision']).toContain(result.status);
  });

  it('hits the prediction limit on a slow orbit that does not close in the window', () => {
    // Pluto-distance orbit (~248 yr period) won't close in the default 5.5-year window.
    const engine = sunEngine();
    const r = 39.5 * AU;
    const v_circ = Math.sqrt(G * M_SUN / r);
    const result = predictOrbit({
      engine,
      ghostBody: {
        mass: 1.3e22,
        position: [r, 0, 0],
        velocity: [0, 0, -v_circ],
        realRadius_m: 1.188e6,
      },
      otherBodies: [{ id: 'sun', realRadius_m: R_SUN }],
    });
    expect(result.status).toBe('prediction_limit');
    // We should have made meaningful angular progress even if not a full revolution.
    expect(Math.abs(result.accumulatedAngle ?? 0)).toBeGreaterThan(0);
  });
});
