const PRESET_LABELS = {
  empty: 'Empty',
  inner_planets: 'Inner Planets',
  jupiter_system: 'Jupiter system',
  solar_system: 'Solar System',
};

export function createResetPresets({ onPreset }) {
  const root = document.createElement('div');
  root.className = 'reset-presets';
  const opts = Object.entries(PRESET_LABELS)
    .map(([k, label]) => `<option value="${k}">${label}</option>`).join('');
  root.innerHTML = `
    <select class="rp-preset" title="Load a preset"><option value="">Load preset…</option>${opts}</select>`;
  document.getElementById('ui-root').appendChild(root);
  // don't propagate to canvas
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  root.querySelector('.rp-preset').addEventListener('change', (e) => {
    if (e.target.value) onPreset(e.target.value);
    e.target.value = '';
  });
  return { root };
}
