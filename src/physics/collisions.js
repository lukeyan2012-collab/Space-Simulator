// Collision classification + resolution rules.
//
// Per user spec:
// - Star or black hole vs anything else → the other body is removed (sucked in).
// - Gas giant vs non-gas-giant (and not a star/BH)   → the non-gas-giant is removed (absorbed).
// - Two non-gas-giants (rocky / moon / asteroid / sat) collide → BOTH are destroyed (explosion).
// - Two gas giants collide → BOTH are destroyed (treat same as the rocky-rocky case).
//
// Uniform spheres in scene units: two records collide when their center-to-center distance is
// less than the sum of their *rendered* radii. The renderer scale is whatever the body's mesh
// has on it right now (post-resize, post-LOD swap).
const GAS_GIANT_IDS = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);

export function bodyType(body) {
  if (!body) return 'other';
  if (body.procedural === 'black_hole') return 'black_hole';
  if (body.procedural === 'star')       return 'star';
  if (body.procedural === 'neutron_star' || body.procedural === 'white_dwarf') return 'star_remnant';
  if (body.category === 'Planets') return GAS_GIANT_IDS.has(body.id) ? 'gas_giant' : 'rocky';
  if (body.category === 'Moons')      return 'moon';
  if (body.category === 'Asteroids')  return 'asteroid';
  if (body.category === 'Satellites') return 'satellite';
  return 'other';
}

// Returns { keep: rec|null, destroy: [rec, ...] } given two colliding records.
export function resolveCollision(a, b) {
  const ta = bodyType(a.body);
  const tb = bodyType(b.body);

  const isAbsorber = (t) => t === 'star' || t === 'black_hole' || t === 'star_remnant';

  if (isAbsorber(ta) && isAbsorber(tb)) {
    // two stars / remnants / BHs colliding → keep the more massive one
    const aM = a.body.realMass_kg ?? 0;
    const bM = b.body.realMass_kg ?? 0;
    return aM >= bM ? { keep: a, destroy: [b] } : { keep: b, destroy: [a] };
  }
  if (isAbsorber(ta)) return { keep: a, destroy: [b] };
  if (isAbsorber(tb)) return { keep: b, destroy: [a] };

  if (ta === 'gas_giant' && tb !== 'gas_giant') return { keep: a, destroy: [b] };
  if (tb === 'gas_giant' && ta !== 'gas_giant') return { keep: b, destroy: [a] };

  // Both gas giants, or neither absorber nor gas giant → mutual destruction
  return { keep: null, destroy: [a, b] };
}

// Scan all pairs for overlap. Returns the FIRST collision (if any) so the caller can resolve
// and re-scan next frame. O(n²) — fine for the <50 bodies this demo handles.
export function findFirstCollision(records) {
  for (let i = 0; i < records.length; i++) {
    const a = records[i];
    const ap = a.object.position;
    const ar = a.object.scale.x;
    for (let j = i + 1; j < records.length; j++) {
      const b = records[j];
      const bp = b.object.position;
      const br = b.object.scale.x;
      const dx = ap.x - bp.x;
      const dy = ap.y - bp.y;
      const dz = ap.z - bp.z;
      const dist2 = dx*dx + dy*dy + dz*dz;
      const rsum = ar + br;
      if (dist2 < rsum * rsum) return [a, b];
    }
  }
  return null;
}
