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

  it('release stops further target updates and leaves target where it was', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.focus(new Vector3(100, 0, 0));
    for (let i = 0; i < 60; i++) ctl.update(1 / 60); // converge near (100,0,0)
    const snapshot = ctl.target.clone();
    ctl.release();
    for (let i = 0; i < 120; i++) ctl.update(1 / 60); // should NOT move
    expect(ctl.target.distanceTo(snapshot)).toBeLessThan(0.01);
    expect(ctl.isFollowing).toBe(false);
  });

  it('follow tracks a moving source each frame', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    const moving = new Vector3(0, 0, 0);
    ctl.follow(() => moving);
    // step the source along x while updating
    for (let i = 0; i < 30; i++) { moving.x += 1; ctl.update(1 / 60); }
    // target should be near (30, 0, 0), well above origin
    expect(ctl.target.x).toBeGreaterThan(20);
    expect(ctl.isFollowing).toBe(true);
  });

  it('resetView restores initial camera position and target, and releases', () => {
    const cam = new PerspectiveCamera();
    cam.position.set(0, 50, 200);
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.follow(() => new Vector3(99, 99, 99));
    ctl.update(1 / 60);
    cam.position.set(1, 2, 3); // user dragged the camera somewhere weird
    ctl.resetView();
    expect(cam.position.x).toBeCloseTo(0, 5);
    expect(cam.position.y).toBeCloseTo(50, 5);
    expect(cam.position.z).toBeCloseTo(200, 5);
    expect(ctl.target.length()).toBeLessThan(0.001); // back at origin
    expect(ctl.isFollowing).toBe(false);
  });

  it('clearFocus is an alias for release', () => {
    const cam = new PerspectiveCamera();
    const ctl = createCameraController(cam, document.createElement('canvas'));
    ctl.follow(() => new Vector3(10, 0, 0));
    expect(ctl.isFollowing).toBe(true);
    ctl.clearFocus();
    expect(ctl.isFollowing).toBe(false);
  });
});
