// SI units throughout the engine. Render layer applies DISTANCE_SCALE only.
export const G = 6.6743e-11;             // m^3 kg^-1 s^-2
export const SEC_PER_DAY = 86400;
export const M_SUN = 1.989e30;           // kg
export const SUPERNOVA_THRESHOLD_KG = 8 * M_SUN;

// Render scaling: 1 unit = 1e9 m (1 Gm). Sun radius ~0.7 units; 1 AU ~150 units.
export const DISTANCE_SCALE = 1 / 1e9;
// Visual size scaling default; applied per body (overridable).
export const SIZE_SCALE_DEFAULT = 0.0005; // tune in Stage 2 with manifest
// Time base: slider 1.0 = 1 sim-day per real second
export const TIME_BASE_SECONDS_PER_REAL_SECOND = SEC_PER_DAY;
// Sub-stepping
export const MAX_SUBSTEPS_PER_FRAME = 8;
// Gravitational softening to avoid singularities
export const SOFTENING_M = 1e3;
