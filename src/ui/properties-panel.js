import { fmtNum } from '@/util/format.js';

export function createPropertiesPanel() {
  const root = document.createElement('aside');
  root.className = 'props-panel';
  root.innerHTML = `<div class="props-empty">Click an object to inspect</div>`;
  document.getElementById('ui-root').appendChild(root);
  // don't let canvas pickers fire when interacting with the panel
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  function update(view) {
    if (!view) { root.innerHTML = `<div class="props-empty">Click an object to inspect</div>`; return; }
    const { body, state, lod } = view;
    const v = state.velocity;
    root.innerHTML = `
      <h3 class="props-name">${body.displayName}</h3>
      <p class="props-desc">${body.description ?? ''}</p>
      <dl>
        <dt>Mass</dt><dd>${fmtNum(state.mass)} kg</dd>
        <dt>Velocity</dt><dd>(${fmtNum(v[0])}, ${fmtNum(v[1])}, ${fmtNum(v[2])}) m/s</dd>
        <dt>Speed</dt><dd>${fmtNum(Math.hypot(v[0],v[1],v[2]))} m/s</dd>
        <dt class="props-lod-label">LOD</dt><dd class="props-lod">${lod}</dd>
      </dl>`;
  }
  return { update };
}
