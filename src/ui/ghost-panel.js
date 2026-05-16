// Right-side panel that appears while configuring a ghost-spawn. Hosts size / spin / speed /
// direction sliders + Insert + Cancel buttons.
export function createGhostPanel({
  onSize = () => {}, onSpin = () => {}, onSpeed = () => {},
  onAzimuth = () => {}, onElevation = () => {},
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

    <label class="gp-row">
      <span class="gp-key">Direction →</span>
      <input class="gp-az" type="range" min="0" max="360" step="1" value="0">
      <span class="gp-az-val gp-val">0°</span>
    </label>

    <label class="gp-row">
      <span class="gp-key">Tilt ↑</span>
      <input class="gp-el" type="range" min="-90" max="90" step="1" value="0">
      <span class="gp-el-val gp-val">0°</span>
    </label>

    <div class="gp-buttons">
      <button class="gp-cancel" type="button">Cancel</button>
      <button class="gp-insert" type="button">Insert</button>
    </div>
    <div class="gp-hint">Yellow arrow on the ghost shows launch direction.</div>`;
  document.getElementById('ui-root').appendChild(root);

  // Don't let canvas pickers fire when interacting with the panel.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  const nameEl = root.querySelector('.gp-name');
  const sizeIn = root.querySelector('.gp-size');
  const spinIn = root.querySelector('.gp-spin');
  const speedIn = root.querySelector('.gp-speed');
  const azIn = root.querySelector('.gp-az');
  const elIn = root.querySelector('.gp-el');
  const sizeVal = root.querySelector('.gp-size-val');
  const spinVal = root.querySelector('.gp-spin-val');
  const speedVal = root.querySelector('.gp-speed-val');
  const azVal = root.querySelector('.gp-az-val');
  const elVal = root.querySelector('.gp-el-val');

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
  azIn.addEventListener('input', () => {
    const v = +azIn.value;
    azVal.textContent = v.toFixed(0) + '°';
    onAzimuth(v);
  });
  elIn.addEventListener('input', () => {
    const v = +elIn.value;
    elVal.textContent = v.toFixed(0) + '°';
    onElevation(v);
  });
  root.querySelector('.gp-cancel').addEventListener('click', () => onCancel());
  root.querySelector('.gp-insert').addEventListener('click', () => onInsert());

  function show(name, defaults = {}) {
    nameEl.textContent = name || '';
    const d = { size: 1, spin: 1, speed: 10000, az: 0, el: 0, ...defaults };
    sizeIn.value = d.size;   sizeVal.textContent = d.size.toFixed(2) + '×';
    spinIn.value = d.spin;   spinVal.textContent = d.spin.toFixed(2) + '×';
    speedIn.value = d.speed; speedVal.textContent = (d.speed / 1000).toFixed(1) + ' km/s';
    azIn.value = d.az;       azVal.textContent = d.az.toFixed(0) + '°';
    elIn.value = d.el;       elVal.textContent = d.el.toFixed(0) + '°';
    root.hidden = false;
  }
  function hide() { root.hidden = true; }

  return { show, hide };
}
