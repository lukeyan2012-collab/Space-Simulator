import { describe, it, expect } from 'vitest';
import { chooseRemnant } from '@/fx/supernova.js';

describe('chooseRemnant', () => {
  const M_SUN = 1.989e30;
  it('white dwarf for ≤ 1.4 M☉ post-loss', () => { expect(chooseRemnant(1.0 * M_SUN)).toBe('white_dwarf'); });
  it('neutron star for 1.4–3 M☉', () => { expect(chooseRemnant(2.5 * M_SUN)).toBe('neutron_star'); });
  it('black hole for > 3 M☉', () => { expect(chooseRemnant(10 * M_SUN)).toBe('bh_stellar'); });
});
