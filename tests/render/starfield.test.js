import { describe, it, expect } from 'vitest';
import { createStarfield } from '@/render/starfield.js';

describe('createStarfield', () => {
  it('returns a Points object with the requested star count', () => {
    const stars = createStarfield({ count: 5000, radius: 5000 });
    expect(stars.isPoints).toBe(true);
    expect(stars.geometry.attributes.position.count).toBe(5000);
  });
});
