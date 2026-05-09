import { describe, it, expect } from 'vitest';
import { createScene } from '@/render/scene.js';

describe('createScene', () => {
  it('returns a scene, perspective camera, and renderer with logarithmic depth', () => {
    const canvas = document.createElement('canvas');
    const { scene, camera, renderer } = createScene(canvas, { width: 800, height: 600 });
    expect(scene).toBeDefined();
    expect(camera.isPerspectiveCamera).toBe(true);
    expect(renderer.capabilities.logarithmicDepthBuffer).toBe(true);
    expect(renderer.domElement).toBe(canvas);
  });
});
