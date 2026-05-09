import { describe, it, expect } from 'vitest';
import { Vector3, PerspectiveCamera } from 'three';
import { createCameraController } from '@/interaction/camera-controls.js';

describe('camera controller', () => {
  it('tweens target toward focus and stops when close', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.focus(new Vector3(100, 0, 0));
    // simulate ~1s @ 60fps
    for (let i = 0; i < 60; i++) ctl.update(1 / 60);
    expect(ctl.target.distanceTo(new Vector3(100, 0, 0))).toBeLessThan(1);
  });

  it('clearFocus resets target to origin', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.focus(new Vector3(50, 0, 0));
    ctl.clearFocus();
    for (let i = 0; i < 120; i++) ctl.update(1 / 60);
    expect(ctl.target.length()).toBeLessThan(1);
  });
});
