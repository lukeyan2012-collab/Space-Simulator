import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAutosave } from '@/persistence/autosave.js';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });

describe('autosave', () => {
  it('writes a snapshot debounced after changes', () => {
    const a = createAutosave({ key: 'k', getSnapshot: () => ({ a: 1 }), debounceMs: 1000 });
    a.markDirty(); a.markDirty(); a.markDirty();
    vi.advanceTimersByTime(999);
    expect(localStorage.getItem('k')).toBeNull();
    vi.advanceTimersByTime(2);
    expect(JSON.parse(localStorage.getItem('k'))).toEqual({ a: 1 });
  });
  it('load returns null when nothing saved', () => {
    const a = createAutosave({ key: 'k', getSnapshot: () => ({}) });
    expect(a.load()).toBeNull();
  });
});
