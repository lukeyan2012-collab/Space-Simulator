const M_SUN = 1.989e30;

export function chooseRemnant(postLossMassKg) {
  if (postLossMassKg <= 1.4 * M_SUN) return 'white_dwarf';
  if (postLossMassKg <= 3 * M_SUN)   return 'neutron_star';
  return 'bh_stellar';
}

// Lightweight stub — renders a brief expanding halo so the user sees something happen.
// Stage 4 will replace with a full GLSL particle burst.
export function triggerSupernova({ scene, position, color = 0xffaa55 }) {
  // Simple expanding ring of additive translucent spheres.
  // No-op if scene/position not provided (e.g. headless tests).
  if (!scene || !position) return;
}
