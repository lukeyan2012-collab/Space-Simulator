import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { bodyType, resolveCollision, findFirstCollision } from '@/physics/collisions.js';

const sun       = { id: 'sun',       procedural: 'star',       category: 'Stars',      realMass_kg: 1.989e30 };
const bh        = { id: 'bh_stellar',procedural: 'black_hole', category: 'Star Remnants & Nebulae', realMass_kg: 1.989e31 };
const jupiter   = { id: 'jupiter',   category: 'Planets',      realMass_kg: 1.898e27 };
const saturn    = { id: 'saturn',    category: 'Planets',      realMass_kg: 5.683e26 };
const earth     = { id: 'earth',     category: 'Planets',      realMass_kg: 5.972e24 };
const mars      = { id: 'mars',      category: 'Planets',      realMass_kg: 6.417e23 };
const moon      = { id: 'the_moon',  category: 'Moons',        realMass_kg: 7.342e22 };
const vesta     = { id: 'vesta',     category: 'Asteroids',    realMass_kg: 2.59e20 };

function fakeRec(body, x = 0, y = 0, z = 0, r = 1) {
  return { id: body.id, body, object: { position: new Vector3(x, y, z), scale: { x: r, y: r, z: r } } };
}

describe('bodyType', () => {
  it('classifies all relevant categories', () => {
    expect(bodyType(sun)).toBe('star');
    expect(bodyType(bh)).toBe('black_hole');
    expect(bodyType(jupiter)).toBe('gas_giant');
    expect(bodyType(earth)).toBe('rocky');
    expect(bodyType(moon)).toBe('moon');
    expect(bodyType(vesta)).toBe('asteroid');
  });
});

describe('resolveCollision', () => {
  it('star absorbs anything else', () => {
    expect(resolveCollision(fakeRec(sun), fakeRec(earth))).toEqual({ keep: expect.objectContaining({ id: 'sun' }),   destroy: [expect.objectContaining({ id: 'earth' })] });
    expect(resolveCollision(fakeRec(mars), fakeRec(sun))).toEqual({  keep: expect.objectContaining({ id: 'sun' }),   destroy: [expect.objectContaining({ id: 'mars' })] });
  });
  it('black hole absorbs anything else', () => {
    expect(resolveCollision(fakeRec(bh), fakeRec(jupiter)).keep.id).toBe('bh_stellar');
    expect(resolveCollision(fakeRec(jupiter), fakeRec(bh)).keep.id).toBe('bh_stellar');
  });
  it('gas giant absorbs non-gas-giant non-star', () => {
    expect(resolveCollision(fakeRec(jupiter), fakeRec(earth)).keep.id).toBe('jupiter');
    expect(resolveCollision(fakeRec(moon),    fakeRec(saturn)).keep.id).toBe('saturn');
  });
  it('two non-gas-giants are both destroyed', () => {
    const r = resolveCollision(fakeRec(earth), fakeRec(mars));
    expect(r.keep).toBe(null);
    expect(r.destroy.map(x => x.id).sort()).toEqual(['earth', 'mars']);
  });
  it('two gas giants are both destroyed', () => {
    const r = resolveCollision(fakeRec(jupiter), fakeRec(saturn));
    expect(r.keep).toBe(null);
    expect(r.destroy.map(x => x.id).sort()).toEqual(['jupiter', 'saturn']);
  });
});

describe('findFirstCollision', () => {
  it('returns null when nothing overlaps', () => {
    const list = [fakeRec(sun, 0, 0, 0, 4), fakeRec(earth, 100, 0, 0, 2)];
    expect(findFirstCollision(list)).toBe(null);
  });
  it('detects overlap by summed scaled radii', () => {
    const list = [fakeRec(sun, 0, 0, 0, 4), fakeRec(earth, 5, 0, 0, 2)];
    const pair = findFirstCollision(list);
    expect(pair).not.toBeNull();
    expect(pair.map(p => p.id).sort()).toEqual(['earth', 'sun']);
  });
});
