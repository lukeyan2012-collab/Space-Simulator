import { describe, it, expect, beforeEach } from 'vitest';
import { createTimeSlider, multiplierFromValue } from '@/ui/time-slider.js';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('time slider', () => {
  it('clamps slider position to [0,1]', () => {
    const ts = createTimeSlider({ initial: 1 });
    expect(ts.value).toBe(1);
    ts.set(2);
    expect(ts.value).toBe(1);
    ts.set(-0.5);
    expect(ts.value).toBe(0);
  });

  it('fires onChange with the raw slider value', () => {
    let last = null;
    const ts = createTimeSlider({ onChange: (v) => (last = v) });
    ts.set(0.25);
    expect(last).toBe(0.25);
  });

  it('paused at 0', () => {
    const ts = createTimeSlider();
    ts.set(0);
    expect(ts.isPaused).toBe(true);
    expect(ts.multiplier).toBe(0);
  });
});

describe('multiplierFromValue', () => {
  it('0 → paused (multiplier 0)', () => {
    expect(multiplierFromValue(0)).toBe(0);
  });
  it('left half is linear slow-mo: 0.5 → 1×, 0.25 → 0.5×', () => {
    expect(multiplierFromValue(0.5)).toBeCloseTo(1, 6);
    expect(multiplierFromValue(0.25)).toBeCloseTo(0.5, 6);
  });
  it('right half is logarithmic fast-forward: 0.75 → 10×, 1.0 → 100×', () => {
    expect(multiplierFromValue(0.75)).toBeCloseTo(10, 6);
    expect(multiplierFromValue(1.0)).toBeCloseTo(100, 6);
  });
  it('is monotonically increasing across the range', () => {
    let prev = -1;
    for (let v = 0; v <= 1; v += 0.05) {
      const m = multiplierFromValue(v);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});

describe('time slider — multiplier exposure', () => {
  it('exposes the mapped multiplier on the controller', () => {
    const ts = createTimeSlider({ initial: 0.5 });
    expect(ts.multiplier).toBeCloseTo(1, 6);
    ts.set(0.75);
    expect(ts.multiplier).toBeCloseTo(10, 6);
    ts.set(1);
    expect(ts.multiplier).toBeCloseTo(100, 6);
  });
});
