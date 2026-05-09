// Two-segment mapping from slider position [0,1] to time multiplier:
//   0           → paused
//   0..0.5      → linear slow-mo, 0× to 1×
//   0.5..1      → logarithmic fast-forward, 1× to 100×
// (Overrides the original masterplan §5 "must never exceed 1" rule per user request 2026-05-09.)
export function multiplierFromValue(v) {
  if (v <= 0) return 0;
  if (v <= 0.5) return v * 2;
  return Math.pow(100, (v - 0.5) * 2);
}

function formatMultiplier(m) {
  if (m === 0) return 'Paused';
  if (m >= 100) return '100×';
  if (m >= 10) return m.toFixed(1) + '×';
  return m.toFixed(2) + '×';
}

export function createTimeSlider({ initial = 0.5, onChange = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'time-slider';
  root.innerHTML = `
    <label class="ts-label">Time <span class="ts-val"></span></label>
    <input type="range" min="0" max="1" step="0.001" value="${initial}" />
    <div class="ts-hint">left = slow-mo · middle = real · right = up to 100× fast-forward</div>`;
  const input = root.querySelector('input');
  const valEl = root.querySelector('.ts-val');
  document.getElementById('ui-root')?.appendChild(root);

  const state = {
    value: clamp(initial),
    isPaused: initial === 0,
    multiplier: multiplierFromValue(clamp(initial)),
  };

  function clamp(v) { return Math.min(1, Math.max(0, +v)); }

  function set(v) {
    state.value = clamp(v);
    state.isPaused = state.value === 0;
    state.multiplier = multiplierFromValue(state.value);
    input.value = String(state.value);
    valEl.textContent = formatMultiplier(state.multiplier);
    onChange(state.value);
  }

  input.addEventListener('input', (e) => set(+e.target.value));

  // initialise label
  set(state.value);

  return {
    set,
    get value() { return state.value; },
    get multiplier() { return state.multiplier; },
    get isPaused() { return state.isPaused; },
  };
}
