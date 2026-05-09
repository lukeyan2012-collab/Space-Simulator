import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHoverCard } from '@/ui/hover-card.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hover card', () => {
  it('shows after debounce delay', () => {
    vi.useFakeTimers();
    const hc = createHoverCard({ delay: 120, isTouch: false });
    hc.show({ displayName: 'Mars', realMass_kg: 6.4e23, realRadius_m: 3.4e6, description: 'Red' }, 100, 100);
    expect(document.querySelector('.hover-card')).toBeFalsy();
    vi.advanceTimersByTime(120);
    expect(document.querySelector('.hover-card')).toBeTruthy();
  });

  it('hide() before delay cancels show', () => {
    vi.useFakeTimers();
    const hc = createHoverCard({ delay: 120, isTouch: false });
    hc.show({ displayName: 'X' }, 0, 0);
    hc.hide();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.hover-card')).toBeFalsy();
  });
});
