export function createAutosave({ key, getSnapshot, debounceMs = 5000 }) {
  let timer = null;
  function markDirty() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(getSnapshot())); } catch {}
    }, debounceMs);
  }
  function load() {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : null;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function clear() { try { localStorage.removeItem(key); } catch {} }
  return { markDirty, load, clear };
}
