const PRESET_LABELS = {
  empty: 'Empty',
  inner_planets: 'Inner Planets',
  jupiter_system: 'Jupiter system',
  solar_system: 'Solar System',
};

export function createResetPresets({ onReset = null, onPreset = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'reset-presets';
  const opts = Object.entries(PRESET_LABELS)
    .map(([k, label]) => `<option value="${k}">${label}</option>`).join('');
  const resetBtnHtml = onReset
    ? `<button type="button" class="rp-reset" title="Clear all bodies (camera unchanged)">Reset</button>`
    : '';
  root.innerHTML = `
    <select class="rp-preset" title="Load a preset"><option value="">Load preset…</option>${opts}</select>
    ${resetBtnHtml}`;
  document.getElementById('ui-root').appendChild(root);

  // Don't propagate to canvas pickers.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  if (onReset) root.querySelector('.rp-reset').addEventListener('click', () => onReset());
  root.querySelector('.rp-preset').addEventListener('change', (e) => {
    if (e.target.value) onPreset(e.target.value);
    e.target.value = '';
  });
  return { root };
}
