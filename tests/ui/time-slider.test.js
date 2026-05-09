import { describe, it, expect, beforeEach } from 'vitest';
import { createTimeSlider } from '@/ui/time-slider.js';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('time slider', () => {
  it('clamps values to [0,1] strictly', () => {
    const ts = createTimeSlider({ initial: 1 });
    expect(ts.value).toBe(1);
    ts.set(2);  // attempted fast-forward — must clamp
    expect(ts.value).toBe(1);
    ts.set(-0.5);
    expect(ts.value).toBe(0);
  });

  it('fires onChange', () => {
    let last = null;
    const ts = createTimeSlider({ onChange: (v) => (last = v) });
    ts.set(0.25);
    expect(last).toBe(0.25);
  });

  it('paused at 0', () => {
    const ts = createTimeSlider();
    ts.set(0);
    expect(ts.isPaused).toBe(true);
  });
});
