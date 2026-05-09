import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLoadingScreen } from '@/ui/loading-screen.js';

beforeEach(() => { document.body.innerHTML = '<div id="loading-screen"></div>'; });

describe('loading screen', () => {
  it('mounts a progress bar and updates width on setProgress', () => {
    const ls = createLoadingScreen();
    ls.setProgress(0.42);
    const bar = document.querySelector('#loading-screen .ls-bar-fill');
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBe('42%');
  });

  it('fadeOut resolves after CSS transition', async () => {
    vi.useFakeTimers();
    const ls = createLoadingScreen();
    const p = ls.fadeOut();
    vi.advanceTimersByTime(700);
    await p;
    expect(document.getElementById('loading-screen').classList.contains('ls-hidden')).toBe(true);
    vi.useRealTimers();
  });

  it('showError replaces the bar with an error message', () => {
    const ls = createLoadingScreen();
    ls.showError('boom');
    expect(document.querySelector('#loading-screen .ls-error').textContent).toContain('boom');
  });
});
