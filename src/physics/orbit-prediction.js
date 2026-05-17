import { G, SEC_PER_DAY } from './constants.js';

// Strict orbit prediction: clones the live engine, drops the ghost in, and integrates
// forward until ONE of these terminal states is reached:
//   - 'orbit'            : accumulated angular sweep around the chosen attractor ≥ 2π
//   - 'escape'           : ghost passes the escape-distance threshold
//   - 'collision'        : ghost overlaps another body's radius
//   - 'prediction_limit' : ran out of steps before any of the above
//
// We don't trust orbital-energy alone to call "orbit confirmed" — energy < 0 means *bound*,
// not *closed*. The only definitive proof of a closed loop is watching the trajectory
// actually complete a revolution. So we accumulate signed angle around the attractor
// (projected onto the angular-momentum plane) and demand ≥ 2π.
const DEFAULTS = {
  maxPredictionDays:        2000,   // ≈ 5.5 years — covers Earth, Mercury, Jupiter inner orbit
  maxPredictionSteps:       2000,   // → 1 day per step at the default window
  samplesPerOrbitCheck:     1,      // sample every Nth step for angle accumulation
  escapeDistanceMultiplier: 50,     // r > 50× r₀ AND moving outward → escape
  collisionRadiusMultiplier: 1,     // body realRadius_m × this for collision tests
};

function pickAttractor(ghostPos, others) {
  let best = null;
  let bestPull = 0;
  for (const b of others) {
    const dx = b.position[0] - ghostPos[0];
    const dy = b.position[1] - ghostPos[1];
    const dz = b.position[2] - ghostPos[2];
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 < 1e-6) continue;
    const pull = b.mass / r2; // G cancels; this is proportional to acceleration on the ghost
    if (pull > bestPull) { bestPull = pull; best = b; }
  }
  return best;
}

function sub(a, b)   { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dot(a, b)   { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function magnitude(v){ return Math.hypot(v[0], v[1], v[2]); }
function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0],
  ];
}
function projectOnPlane(v, n) {
  const k = dot(v, n);
  return [v[0] - k*n[0], v[1] - k*n[1], v[2] - k*n[2]];
}
function signedAngleBetween(v1, v2, planeNormal) {
  const m1 = magnitude(v1);
  const m2 = magnitude(v2);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  const c = Math.max(-1, Math.min(1, dot(v1, v2) / (m1 * m2)));
  const ang = Math.acos(c);
  const x = cross(v1, v2);
  return dot(x, planeNormal) >= 0 ? ang : -ang;
}

// Two modes:
//   - ghostBody → trace a body that ISN'T yet in the engine (used by the spawn configurator)
//   - existingBodyId → trace a body that's ALREADY in the engine (used by the "Show orbits"
//     toggle for a selected/followed body)
//
// `otherBodies` is the runtime list of records — we need both `id` (matches engine) and
// `realRadius_m` for collision tests, since the engine doesn't carry radii.
//
// Returns:
//   { status, trajectory, message, attractorId, accumulatedAngle, finalRelDistance }
export function predictOrbit({ engine, ghostBody, existingBodyId, otherBodies, options = {} }) {
  const opts = { ...DEFAULTS, ...options };
  if (!engine || (!ghostBody && !existingBodyId)) {
    return { status: 'prediction_limit', trajectory: [], message: 'No engine / target.' };
  }
  const sim = engine.clone();
  let targetId, targetRadius_m;
  if (existingBodyId) {
    targetId = existingBodyId;
    const meta = otherBodies.find(b => b.id === existingBodyId);
    targetRadius_m = +(meta?.realRadius_m) || 0;
  } else {
    targetId = '__predict_ghost__';
    sim.addBody({
      id: targetId,
      mass: ghostBody.mass,
      position: [...ghostBody.position],
      velocity: [...ghostBody.velocity],
    });
    targetRadius_m = +(ghostBody.realRadius_m) || 0;
  }

  // Look-up of real radii by id for collision tests.
  const radiiById = new Map();
  for (const b of otherBodies) radiiById.set(b.id, +b.realRadius_m || 0);

  const initState = sim.getState(targetId);
  if (!initState) {
    return { status: 'prediction_limit', trajectory: [], message: 'Target not in sim.' };
  }
  const initialOthers = sim.all().filter(b => b.id !== targetId);
  const attractorSeed = pickAttractor(initState.position, initialOthers);
  if (!attractorSeed) {
    return { status: 'escape', trajectory: [[...initState.position]], message: 'No attractor — straight-line flight.' };
  }
  const attractorId = attractorSeed.id;

  // Initial relative geometry → defines the orbital plane via angular momentum.
  const initRel  = sub(initState.position, attractorSeed.position);
  const initVel  = sub(initState.velocity, attractorSeed.velocity);
  const initR    = magnitude(initRel);
  const hVec     = cross(initRel, initVel);
  const hMag     = magnitude(hVec);
  if (hMag < 1e-3) {
    return {
      status: 'collision', trajectory: [[...initState.position]],
      message: `Will fall straight into ${attractorId}.`, attractorId,
    };
  }
  const planeNormal = [hVec[0]/hMag, hVec[1]/hMag, hVec[2]/hMag];

  const dt        = (opts.maxPredictionDays * SEC_PER_DAY) / opts.maxPredictionSteps;
  const escapeR   = initR * opts.escapeDistanceMultiplier;
  const targetR   = targetRadius_m * opts.collisionRadiusMultiplier;

  const trajectory = [[...initState.position]];
  let prevRelProj  = projectOnPlane(initRel, planeNormal);
  let accumAngle   = 0;

  for (let step = 0; step < opts.maxPredictionSteps; step++) {
    sim.step(dt);
    const g = sim.getState(targetId);
    if (!g) {
      return { status: 'prediction_limit', trajectory, message: 'Sim lost the target.', attractorId };
    }
    trajectory.push([...g.position]);

    const a = sim.getState(attractorId);
    if (!a) {
      return { status: 'prediction_limit', trajectory, message: 'Attractor disappeared in sim.', attractorId };
    }

    // Collision against any real body.
    for (const other of sim.all()) {
      if (other.id === targetId) continue;
      const d = magnitude(sub(g.position, other.position));
      const r = (radiiById.get(other.id) || 0) * opts.collisionRadiusMultiplier;
      if (d < r + targetR) {
        return {
          status: 'collision', trajectory,
          message: `Collides with ${other.id} at t≈${((step * dt) / SEC_PER_DAY).toFixed(1)}d.`,
          attractorId,
        };
      }
    }

    const rel  = sub(g.position, a.position);
    const rMag = magnitude(rel);

    // Escape: well past initial distance AND moving outward.
    if (rMag > escapeR) {
      const relV  = sub(g.velocity, a.velocity);
      const radialV = dot(rel, relV) / (rMag || 1); // > 0 → moving outward
      if (radialV > 0) {
        return {
          status: 'escape', trajectory,
          message: `Exceeded ${opts.escapeDistanceMultiplier}× initial distance and still outbound.`,
          attractorId, finalRelDistance: rMag,
        };
      }
    }

    if ((step % opts.samplesPerOrbitCheck) === 0) {
      const proj = projectOnPlane(rel, planeNormal);
      accumAngle += signedAngleBetween(prevRelProj, proj, planeNormal);
      prevRelProj = proj;
      if (Math.abs(accumAngle) >= 2 * Math.PI) {
        return {
          status: 'orbit', trajectory,
          message: `Completes a full orbit around ${attractorId}.`,
          attractorId, accumulatedAngle: accumAngle,
        };
      }
    }
  }

  return {
    status: 'prediction_limit', trajectory,
    message: `No full orbit confirmed within ${opts.maxPredictionDays} simulated days.`,
    attractorId, accumulatedAngle: accumAngle,
  };
}
