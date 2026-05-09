import { describe, it, expect } from 'vitest';
import { ENGINE_INTERFACE_KEYS } from '@/physics/engine-interface.js';
import { createVerletEngine } from '@/physics/verlet-engine.js';

describe('engine contract', () => {
  it('verlet engine implements the interface', () => {
    const e = createVerletEngine();
    for (const k of ENGINE_INTERFACE_KEYS) expect(typeof e[k]).toBe('function');
  });
});
