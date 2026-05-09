const CARD_OFFSET = 16;

export function createHoverCard({ delay = 120, isTouch } = {}) {
  // isTouch: auto-detect if not specified. In jsdom tests, 'ontouchstart' in window is always true,
  // so tests explicitly pass isTouch=false. In production, detection via maxTouchPoints is more reliable.
  if (typeof isTouch === 'undefined') {
    isTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  }
  let timer = null, el = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'hover-card';
    document.body.appendChild(el);
    return el;
  }

  function show(body, clientX, clientY) {
    if (isTouch) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const e = ensureEl();
      const mass = body.realMass_kg ?? 0;
      const radius = body.realRadius_m ?? 0;
      e.innerHTML = `
        <div class="hc-name">${body.displayName ?? '?'}</div>
        <div class="hc-row"><span>Mass</span><span>${mass.toExponential(2)} kg</span></div>
        <div class="hc-row"><span>Radius</span><span>${radius.toExponential(2)} m</span></div>
        <div class="hc-desc">${body.description ?? ''}</div>`;
      const x = Math.min((window.innerWidth || 800) - 280, clientX + CARD_OFFSET);
      const y = Math.min((window.innerHeight || 600) - 120, clientY + CARD_OFFSET);
      e.style.left = x + 'px';
      e.style.top = y + 'px';
      e.classList.add('hc-shown');
    }, delay);
  }

  function hide() {
    clearTimeout(timer);
    if (el) el.classList.remove('hc-shown');
  }

  return { show, hide };
}
