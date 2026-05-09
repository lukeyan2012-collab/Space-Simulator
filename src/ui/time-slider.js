export function createTimeSlider({ initial = 1, onChange = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'time-slider';
  root.innerHTML = `
    <label class="ts-label">Time <span class="ts-val">${initial.toFixed(2)}</span></label>
    <input type="range" min="0" max="1" step="0.001" value="${initial}" />
    <div class="ts-hint">0 = paused · 1 = 1 day/sec</div>`;
  const input = root.querySelector('input');
  const valEl = root.querySelector('.ts-val');
  document.getElementById('ui-root')?.appendChild(root);

  const state = { value: clamp(initial), isPaused: initial === 0 };

  function clamp(v) { return Math.min(1, Math.max(0, +v)); }

  function set(v) {
    state.value = clamp(v);
    state.isPaused = state.value === 0;
    input.value = String(state.value);
    valEl.textContent = state.value.toFixed(2);
    onChange(state.value);
  }

  input.addEventListener('input', (e) => set(+e.target.value));

  return {
    set,
    get value() { return state.value; },
    get isPaused() { return state.isPaused; },
  };
}
