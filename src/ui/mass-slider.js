import { SUPERNOVA_THRESHOLD_KG } from '@/physics/constants.js';
import { chooseRemnant, triggerSupernova } from '@/fx/supernova.js';

export function createMassControls({
  getSelected,
  getRecords,
  engine,
  manifest,
  scene,
  spawn,
  removeRecord,
  confirmFn = (msg) => (typeof window !== 'undefined' ? window.confirm(msg) : true),
}) {
  const root = document.createElement('div');
  root.className = 'mass-controls';
  root.innerHTML = `
    <label>Visual size <input class="mc-size" type="range" min="0.1" max="100" step="0.1" value="1"></label>
    <label>Mass × <input class="mc-mass" type="range" min="0.01" max="1000" step="0.01" value="1" disabled></label>
    <span class="mc-mass-val">1.00×</span>`;
  document.getElementById('ui-root').appendChild(root);
  // don't propagate clicks to the canvas
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  const sizeEl = root.querySelector('.mc-size');
  const massEl = root.querySelector('.mc-mass');
  const massValEl = root.querySelector('.mc-mass-val');

  function visualSize() { return Math.max(0.0001, +sizeEl.value); }

  sizeEl.addEventListener('input', () => {
    const m = visualSize();
    for (const rec of getRecords()) {
      const base = rec._baseScale ?? rec.sceneScale ?? 1;
      rec.object.scale.setScalar(base * m);
    }
  });

  function refreshMassEnabled() {
    const sel = getSelected();
    massEl.disabled = !sel;
    if (sel) {
      const s = engine.getState(sel.id);
      const factor = s ? s.mass / sel.body.realMass_kg : 1;
      massEl.value = String(Math.max(0.01, Math.min(1000, factor)));
      massValEl.textContent = (+massEl.value).toFixed(2) + '×';
    } else {
      massEl.value = '1';
      massValEl.textContent = '1.00×';
    }
  }

  massEl.addEventListener('input', () => {
    const sel = getSelected();
    if (!sel) return;
    const factor = +massEl.value;
    const newMass = sel.body.realMass_kg * factor;
    massValEl.textContent = factor.toFixed(2) + '×';
    engine.setState(sel.id, { mass: newMass });

    // Supernova check (only stars)
    if (sel.body.category === 'Stars' && newMass > SUPERNOVA_THRESHOLD_KG) {
      const ok = confirmFn(`This will destroy ${sel.body.displayName} in a supernova. Continue?`);
      if (!ok) {
        engine.setState(sel.id, { mass: sel.body.realMass_kg });
        massEl.value = '1'; massValEl.textContent = '1.00×';
        return;
      }
      const remnantId = chooseRemnant(newMass * 0.5); // half mass lost in collapse
      const state = engine.getState(sel.id);
      triggerSupernova({ scene, position: state.position });
      engine.removeBody(sel.id);
      removeRecord(sel.id);
      const remnantSpec = manifest.bodies.find(b => b.id === remnantId);
      if (remnantSpec) spawn(remnantSpec, state.position, state.velocity);
    }
  });

  return { visualSize, refreshMassEnabled };
}
