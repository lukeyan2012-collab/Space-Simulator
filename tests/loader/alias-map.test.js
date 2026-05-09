import { describe, it, expect } from 'vitest';
import { resolveCandidates } from '@/loader/alias-map.js';

describe('resolveCandidates', () => {
  it('produces 4k → 1k → bare order for normal names', () => {
    expect(resolveCandidates('mercury', 'high')).toEqual(['mercury_4k.glb', 'mercury_1k.glb', 'mercury.glb']);
    expect(resolveCandidates('mercury', 'low')).toEqual(['mercury_1k.glb', 'mercury.glb']);
  });

  it('expands the ganymede alias to both spellings', () => {
    const out = resolveCandidates('ganymede', 'high');
    expect(out).toEqual([
      'ganymede_4k.glb','ganimedes_4k.glb','ganymade_4k.glb',
      'ganymede_1k.glb','ganimedes_1k.glb','ganymade_1k.glb',
      'ganymede.glb',   'ganimedes.glb',   'ganymade.glb',
    ]);
  });

  it('returns lowercase candidates so case-insensitive matching is possible downstream', () => {
    expect(resolveCandidates('IO', 'high')).toEqual(['io_4k.glb','io_1k.glb','io.glb']);
  });
});
