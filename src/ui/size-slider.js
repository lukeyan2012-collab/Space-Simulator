// Top-center "Adjust size" slider that appears only while a body is camera-pinned.
// Range matches the old drag-resize: 0.1× ↔ 12× (volume scales as r³).
export function createSizeSlider({ onSize = () => {}, min = 0.1, max = 12 } = {}) {
  const root = document.createElement('div');
  root.className = 'size-slider';
  root.hidden = true;
  root.innerHTML = `
    <label class="ss-label">Adjust size <span class="ss-name"></span> <span class="ss-val">1.00×</span></label>
    <input type="range" min="${min}" max="${max}" step="0.05" value="1" />`;
  document.getElementById('ui-root').appendChild(root);

  // Don't let the canvas pickers fire when interacting with the slider.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  const input = root.querySelector('input');
  const valEl = root.querySelector('.ss-val');
  const nameEl = root.querySelector('.ss-name');

  input.addEventListener('input', (e) => {
    const v = +e.target.value;
    valEl.textContent = v.toFixed(2) + '×';
    onSize(v);
  });

  return {
    show(initial = 1, label = '') {
      input.value = String(initial);
      valEl.textContent = (+initial).toFixed(2) + '×';
      nameEl.textContent = label ? `(${label})` : '';
      root.hidden = false;
    },
    hide() { root.hidden = true; },
    setValue(v) {
      input.value = String(v);
      valEl.textContent = (+v).toFixed(2) + '×';
    },
  };
}
