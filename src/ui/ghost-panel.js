// Right-side panel that appears while configuring a ghost-spawn. Hosts size / spin / speed
// sliders + Insert + Cancel. Direction is set by dragging the yellow arrow on the ghost
// itself — there's no slider for it.
export function createGhostPanel({
  onSize = () => {}, onSpin = () => {}, onSpeed = () => {},
  onInsert = () => {}, onCancel = () => {},
} = {}) {
  const root = document.createElement('aside');
  root.className = 'ghost-panel';
  root.hidden = true;
  root.innerHTML = `
    <h3 class="gp-title">Configure body</h3>
    <div class="gp-name"></div>

    <label class="gp-row">
      <span class="gp-key">Size</span>
      <input class="gp-size" type="range" min="0.2" max="5" step="0.05" value="1">
      <span class="gp-size-val gp-val">1.00×</span>
    </label>

    <label class="gp-row">
      <span class="gp-key">Spin ×</span>
      <input class="gp-spin" type="range" min="0" max="3" step="0.05" value="1">
      <span class="gp-spin-val gp-val">1.00×</span>
    </label>

    <label class="gp-row">
      <span class="gp-key">Speed</span>
      <input class="gp-speed" type="range" min="0" max="50000" step="500" value="10000">
      <span class="gp-speed-val gp-val">10 km/s</span>
    </label>

    <div class="gp-orbit-status gps-prediction_limit">Adjust speed and direction…</div>

    <div class="gp-buttons">
      <button class="gp-cancel" type="button">Cancel</button>
      <button class="gp-insert" type="button">Insert</button>
    </div>
    <div class="gp-hint">Click + drag the ghost to aim the yellow launch arrow.</div>`;
  document.getElementById('ui-root').appendChild(root);

  // Don't let canvas pickers fire when interacting with the panel.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  const nameEl = root.querySelector('.gp-name');
  const sizeIn = root.querySelector('.gp-size');
  const spinIn = root.querySelector('.gp-spin');
  const speedIn = root.querySelector('.gp-speed');
  const sizeVal = root.querySelector('.gp-size-val');
  const spinVal = root.querySelector('.gp-spin-val');
  const speedVal = root.querySelector('.gp-speed-val');

  sizeIn.addEventListener('input', () => {
    const v = +sizeIn.value;
    sizeVal.textContent = v.toFixed(2) + '×';
    onSize(v);
  });
  spinIn.addEventListener('input', () => {
    const v = +spinIn.value;
    spinVal.textContent = v.toFixed(2) + '×';
    onSpin(v);
  });
  speedIn.addEventListener('input', () => {
    const v = +speedIn.value;
    speedVal.textContent = (v / 1000).toFixed(1) + ' km/s';
    onSpeed(v);
  });
  root.querySelector('.gp-cancel').addEventListener('click', () => onCancel());
  root.querySelector('.gp-insert').addEventListener('click', () => onInsert());

  const statusEl = root.querySelector('.gp-orbit-status');
  const STATUS_LABELS = {
    orbit:            'Confirmed orbit',
    escape:           'Escape trajectory',
    collision:        'Collision predicted',
    prediction_limit: 'Prediction limit reached — no full orbit confirmed.',
  };
  function setOrbitStatus(status, message) {
    statusEl.className = 'gp-orbit-status gps-' + (status || 'prediction_limit');
    const label = STATUS_LABELS[status] ?? 'Computing…';
    statusEl.textContent = message ? `${label} — ${message}` : label;
  }

  function show(name, defaults = {}) {
    nameEl.textContent = name || '';
    const d = { size: 1, spin: 1, speed: 10000, ...defaults };
    sizeIn.value = d.size;   sizeVal.textContent = (+d.size).toFixed(2) + '×';
    spinIn.value = d.spin;   spinVal.textContent = (+d.spin).toFixed(2) + '×';
    speedIn.value = d.speed; speedVal.textContent = ((+d.speed) / 1000).toFixed(1) + ' km/s';
    root.hidden = false;
  }
  function hide() { root.hidden = true; }

  return { show, hide, setOrbitStatus };
}
