import { describe, it, expect } from 'vitest';
import manifest from '@/data/bodies.json';

describe('manifest', () => {
  it('has exactly the 6 categories from masterplan §4', () => {
    const cats = new Set(manifest.bodies.map(b => b.category));
    expect(cats).toEqual(new Set([
      'Planets','Moons','Stars','Star Remnants & Nebulae','Asteroids','Satellites',
    ]));
  });
  it('every entry has a unique id', () => {
    const ids = manifest.bodies.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('asset-backed entries have an assetName; procedural entries do not', () => {
    for (const b of manifest.bodies) {
      if (b.procedural) expect(b.assetName).toBeNull();
      else expect(typeof b.assetName).toBe('string');
    }
  });
});
