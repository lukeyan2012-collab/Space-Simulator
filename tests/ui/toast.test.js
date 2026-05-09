import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToaster } from '@/ui/toast.js';

beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });

describe('toaster', () => {
  it('shows a toast and auto-dismisses', () => {
    const t = createToaster();
    t.show('hello');
    expect(document.querySelector('.toast').textContent).toBe('hello');
    vi.advanceTimersByTime(4100);
    expect(document.querySelector('.toast')).toBeFalsy();
  });
  it('dedupes the same message within 5s', () => {
    const t = createToaster();
    t.show('x'); t.show('x'); t.show('x');
    expect(document.querySelectorAll('.toast').length).toBe(1);
  });
});
