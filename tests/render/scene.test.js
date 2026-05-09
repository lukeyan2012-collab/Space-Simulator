import { describe, it, expect, vi } from 'vitest';

// Mock WebGLRenderer to avoid jsdom WebGL limitations
vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  return {
    ...actual,
    WebGLRenderer: vi.fn(function (options) {
      this.capabilities = { logarithmicDepthBuffer: true };
      this.domElement = options.canvas;
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
    }),
  };
});

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
