const CATEGORIES = ['Planets','Moons','Stars','Star Remnants & Nebulae','Asteroids','Satellites'];

export function createSidebar({ manifest, onDragStart = () => {}, onTapAdd = () => {} }) {
  const root = document.createElement('aside');
  root.className = 'sidebar';
  root.innerHTML = `
    <header><h2>Bodies</h2><button class="sb-toggle" aria-label="Collapse">‹</button></header>
    <input class="sb-search" type="search" placeholder="Search…" />
    <div class="sb-list"></div>`;
  document.getElementById('ui-root').appendChild(root);
  // Don't let canvas pickers / camera double-click fire when clicking inside the sidebar.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.stopPropagation());
  const list = root.querySelector('.sb-list');

  for (const cat of CATEGORIES) {
    const section = document.createElement('section');
    section.className = 'sb-category';
    section.innerHTML = `<h3>${cat}</h3><ul></ul>`;
    const ul = section.querySelector('ul');
    for (const b of manifest.bodies.filter(x => x.category === cat)) {
      const li = document.createElement('li');
      li.className = 'sb-item';
      li.dataset.bodyId = b.id;
      li.draggable = true;
      li.innerHTML = `<span class="sb-dot" style="background:${b.defaultColor}"></span>${b.displayName}`;
      li.addEventListener('dragstart', (e) => {
        if (e.dataTransfer && typeof e.dataTransfer.setData === 'function') {
          try { e.dataTransfer.setData('text/plain', b.id); } catch {}
        }
        onDragStart(b.id);
      });
      li.addEventListener('click', () => onTapAdd(b.id));
      ul.appendChild(li);
    }
    list.appendChild(section);
  }

  const search = root.querySelector('.sb-search');
  search.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const item of root.querySelectorAll('.sb-item')) {
      const hit = !q || item.textContent.toLowerCase().includes(q);
      item.classList.toggle('sb-hidden', !hit);
    }
    for (const sec of root.querySelectorAll('.sb-category')) {
      const anyVisible = sec.querySelector('.sb-item:not(.sb-hidden)');
      sec.style.display = anyVisible ? '' : 'none';
    }
  });

  root.querySelector('.sb-toggle').addEventListener('click', () => root.classList.toggle('sb-collapsed'));

  return { root };
}
