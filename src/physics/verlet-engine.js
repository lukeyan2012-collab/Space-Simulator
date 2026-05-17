import { G, SOFTENING_M } from './constants.js';

let _id = 0;
const nextId = () => `b${++_id}`;

export function createVerletEngine() {
  /** @type {Map<string, {id:string,mass:number,position:Float64Array,velocity:Float64Array,acc:Float64Array,accPrev:Float64Array}>} */
  const bodies = new Map();
  let dirty = true;

  function addBody({ id = nextId(), mass, position, velocity }) {
    const b = {
      id,
      mass: +mass,
      position: Float64Array.from(position),
      velocity: Float64Array.from(velocity),
      acc:     new Float64Array(3),
      accPrev: new Float64Array(3),
    };
    bodies.set(id, b);
    dirty = true;
    return id;
  }

  function removeBody(id) { bodies.delete(id); dirty = true; }

  function getState(id) {
    const b = bodies.get(id); if (!b) return undefined;
    return { id, mass: b.mass, position: [b.position[0], b.position[1], b.position[2]], velocity: [b.velocity[0], b.velocity[1], b.velocity[2]] };
  }

  function setState(id, partial) {
    const b = bodies.get(id); if (!b) return;
    if (partial.mass != null) b.mass = +partial.mass;
    if (partial.position) { b.position[0] = partial.position[0]; b.position[1] = partial.position[1]; b.position[2] = partial.position[2]; }
    if (partial.velocity) { b.velocity[0] = partial.velocity[0]; b.velocity[1] = partial.velocity[1]; b.velocity[2] = partial.velocity[2]; }
    dirty = true;
  }

  function all() {
    const out = [];
    for (const b of bodies.values()) out.push(getState(b.id));
    return out;
  }

  function clear() { bodies.clear(); dirty = true; }

  // Snapshot the current state into a fresh engine. Used by orbit prediction so we can
  // simulate forward without disturbing the live world.
  function clone() {
    const fresh = createVerletEngine();
    for (const b of bodies.values()) {
      fresh.addBody({
        id: b.id,
        mass: b.mass,
        position: [b.position[0], b.position[1], b.position[2]],
        velocity: [b.velocity[0], b.velocity[1], b.velocity[2]],
      });
    }
    return fresh;
  }

  function computeAccelerations() {
    const arr = [...bodies.values()];
    for (const b of arr) { b.acc[0] = 0; b.acc[1] = 0; b.acc[2] = 0; }
    const eps2 = SOFTENING_M * SOFTENING_M;
    for (let i = 0; i < arr.length; i++) {
      const bi = arr[i];
      for (let j = i + 1; j < arr.length; j++) {
        const bj = arr[j];
        const dx = bj.position[0] - bi.position[0];
        const dy = bj.position[1] - bi.position[1];
        const dz = bj.position[2] - bi.position[2];
        const r2 = dx*dx + dy*dy + dz*dz + eps2;
        const invR = 1 / Math.sqrt(r2);
        const invR3 = invR * invR * invR;
        const fij_overR = G * invR3;
        bi.acc[0] += fij_overR * bj.mass * dx;
        bi.acc[1] += fij_overR * bj.mass * dy;
        bi.acc[2] += fij_overR * bj.mass * dz;
        bj.acc[0] -= fij_overR * bi.mass * dx;
        bj.acc[1] -= fij_overR * bi.mass * dy;
        bj.acc[2] -= fij_overR * bi.mass * dz;
      }
    }
  }

  function step(dt) {
    if (dt <= 0 || bodies.size === 0) return;
    if (dirty) { computeAccelerations(); dirty = false; }
    // x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
    const halfDt2 = 0.5 * dt * dt;
    for (const b of bodies.values()) {
      b.accPrev[0] = b.acc[0]; b.accPrev[1] = b.acc[1]; b.accPrev[2] = b.acc[2];
      b.position[0] += b.velocity[0] * dt + b.accPrev[0] * halfDt2;
      b.position[1] += b.velocity[1] * dt + b.accPrev[1] * halfDt2;
      b.position[2] += b.velocity[2] * dt + b.accPrev[2] * halfDt2;
    }
    computeAccelerations();
    // v(t+dt) = v(t) + 0.5*(a(t)+a(t+dt))*dt
    const halfDt = 0.5 * dt;
    for (const b of bodies.values()) {
      b.velocity[0] += (b.accPrev[0] + b.acc[0]) * halfDt;
      b.velocity[1] += (b.accPrev[1] + b.acc[1]) * halfDt;
      b.velocity[2] += (b.accPrev[2] + b.acc[2]) * halfDt;
    }
  }

  return { addBody, removeBody, getState, setState, all, clear, step, clone };
}
