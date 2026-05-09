const MODES = [
  { value: 'stars', label: 'Stars' },
  { value: 'grid',  label: 'Gridlines' },
  { value: 'warp',  label: 'Spacetime warp' },
];

export function createBackgroundSelector({ onChange = () => {}, initial = 'stars' } = {}) {
  const root = document.createElement('div');
  root.className = 'bg-selector';
  const opts = MODES.map(m =>
    `<option value="${m.value}"${m.value === initial ? ' selected' : ''}>${m.label}</option>`
  ).join('');
  root.innerHTML = `<label>Background <select class="bs-select">${opts}</select></label>`;
  document.getElementById('ui-root').appendChild(root);

  // Keep clicks/drags inside the selector from triggering the canvas pickers.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  const sel = root.querySelector('select');
  sel.addEventListener('change', (e) => onChange(e.target.value));

  return { root, get value() { return sel.value; } };
}
