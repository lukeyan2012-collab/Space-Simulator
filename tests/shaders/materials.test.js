import { describe, it, expect } from 'vitest';
import { createStarMaterial, blackbodyColor } from '@/shaders/star-material.js';
import { createNebulaMaterial } from '@/shaders/nebula-material.js';
import { createBlackHoleMaterial } from '@/shaders/black-hole-material.js';

describe('star material', () => {
  it('exposes a temperature uniform and a color derived from it', () => {
    const m = createStarMaterial({ temperature_K: 5778 });
    expect(m.isShaderMaterial).toBe(true);
    expect(m.uniforms.uTemp.value).toBeCloseTo(5778);
    expect(m.uniforms.uColor.value.isColor).toBe(true);
  });
  it('hotter stars are bluer (B channel higher) than cool red stars', () => {
    const cool = blackbodyColor(3000);
    const hot  = blackbodyColor(20000);
    expect(hot.b).toBeGreaterThan(cool.b);
    expect(cool.r).toBeGreaterThan(cool.b);
  });
});

describe('nebula material', () => {
  it('two instances have different randomized colors and seeds', () => {
    const a = createNebulaMaterial();
    const b = createNebulaMaterial();
    expect(a.uniforms.uSeed.value).not.toBe(b.uniforms.uSeed.value);
    // It's astronomically unlikely both random colors collide on all channels at once.
    const sameColor =
      a.uniforms.uColorA.value.equals(b.uniforms.uColorA.value) &&
      a.uniforms.uColorB.value.equals(b.uniforms.uColorB.value);
    expect(sameColor).toBe(false);
  });
});

describe('black hole material', () => {
  it('is a shader material with a uTime uniform', () => {
    const m = createBlackHoleMaterial();
    expect(m.isShaderMaterial).toBe(true);
    expect(m.uniforms.uTime.value).toBe(0);
  });
});
