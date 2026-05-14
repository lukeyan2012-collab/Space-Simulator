const CATEGORIES = ['Planets','Moons','Stars','Star Remnants & Nebulae','Asteroids','Satellites'];

// Horizontal category strip (scrollable by drag / wheel). Clicking a category expands a
// dropdown listing its bodies; clicking the active category again collapses. A search box
// across the strip filters across ALL categories regardless of which is active.
export function createSidebar({ manifest, onDragStart = () => {}, onTapAdd = () => {} }) {
  const root = document.createElement('aside');
  root.className = 'sidebar';
  root.innerHTML = `
    <div class="sb-row">
      <input class="sb-search" type="search" placeholder="Search…" />
      <div class="sb-cats" role="tablist"></div>
    </div>
    <div class="sb-items" hidden></div>`;
  document.getElementById('ui-root').appendChild(root);
  // Stop canvas pickers from firing through the sidebar.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());

  const cats = root.querySelector('.sb-cats');
  const itemsPane = root.querySelector('.sb-items');
  const search = root.querySelector('.sb-search');
  let activeCategory = null;

  function makeItem(body) {
    const li = document.createElement('div');
    li.className = 'sb-item';
    li.dataset.bodyId = body.id;
    li.draggable = true;
    li.innerHTML = `<span class="sb-dot" style="background:${body.defaultColor}"></span>${body.displayName}`;
    li.addEventListener('dragstart', (e) => {
      if (e.dataTransfer && typeof e.dataTransfer.setData === 'function') {
        try { e.dataTransfer.setData('text/plain', body.id); } catch {}
      }
      onDragStart(body.id);
    });
    li.addEventListener('click', () => onTapAdd(body.id));
    return li;
  }

  function buildItems(filterFn) {
    itemsPane.innerHTML = '';
    const list = manifest.bodies.filter(filterFn);
    for (const b of list) itemsPane.appendChild(makeItem(b));
  }

  function highlightActive() {
    for (const btn of cats.querySelectorAll('.sb-cat')) {
      btn.classList.toggle('sb-cat-active', btn.dataset.cat === activeCategory);
    }
  }

  function setActive(cat) {
    if (search.value.trim()) {
      // search is the source of truth while typing; clicking a category just remembers
      // which one is highlighted for when search clears
      activeCategory = cat;
      highlightActive();
      return;
    }
    if (activeCategory === cat) {
      activeCategory = null;
      itemsPane.innerHTML = '';
      itemsPane.hidden = true;
    } else {
      activeCategory = cat;
      buildItems((b) => b.category === cat);
      itemsPane.hidden = false;
    }
    highlightActive();
  }

  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sb-cat';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => setActive(cat));
    cats.appendChild(btn);
  }

  search.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      if (activeCategory) {
        buildItems((b) => b.category === activeCategory);
        itemsPane.hidden = false;
      } else {
        itemsPane.hidden = true;
      }
      return;
    }
    // Global search across all categories.
    buildItems((b) => b.displayName.toLowerCase().includes(q));
    itemsPane.hidden = false;
  });

  // Drag-to-scroll on the category strip (anywhere except a button).
  let dragScroll = null;
  cats.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragScroll = { startX: e.clientX, startScroll: cats.scrollLeft };
    cats.classList.add('sb-cats-grabbing');
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragScroll) return;
    cats.scrollLeft = dragScroll.startScroll - (e.clientX - dragScroll.startX);
  });
  window.addEventListener('pointerup', () => {
    if (!dragScroll) return;
    dragScroll = null;
    cats.classList.remove('sb-cats-grabbing');
  });

  // Wheel → horizontal scroll on the strip (vertical wheel deltas are translated).
  cats.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    cats.scrollLeft += e.deltaY;
  }, { passive: false });

  return { root };
}
