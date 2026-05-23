// Bottom-right gear button → settings panel. Currently exposes the about:blank launcher
// (open the simulator inside an about:blank tab so the address bar hides the real URL).
// Designed to grow — future settings (graphics, autosave, etc.) drop in as new <section>s.
export function createSettingsPanel() {
  const root = document.getElementById('ui-root') || document.body;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'settings-btn';
  btn.title = 'Settings';
  btn.setAttribute('aria-label', 'Settings');
  // Inline SVG so it works without an icon font.
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>
    </svg>`;
  root.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="sp-header">
      <h3>Settings</h3>
      <button type="button" class="sp-close" aria-label="Close">×</button>
    </div>
    <section class="sp-section">
      <div class="sp-row">
        <div class="sp-label">
          <div class="sp-key">Launch in about:blank</div>
          <div class="sp-desc">Re-opens the simulator in a new tab whose address bar shows <code>about:blank</code> instead of the site URL.</div>
        </div>
        <button type="button" class="sp-action ab-launch">Launch</button>
      </div>
    </section>
  `;
  root.appendChild(panel);

  // Stop canvas pickers from firing through the panel/button.
  for (const el of [btn, panel]) {
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  let open = false;
  function setOpen(v) {
    open = v;
    panel.hidden = !v;
    btn.classList.toggle('settings-btn-active', v);
  }
  btn.addEventListener('click', () => setOpen(!open));
  panel.querySelector('.sp-close').addEventListener('click', () => setOpen(false));

  // Esc closes the panel (without affecting other Esc handlers in main.js — those still
  // run for selection/ghost). We just intercept and consume only when the panel is open.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) { setOpen(false); e.stopPropagation(); }
  }, { capture: true });

  panel.querySelector('.ab-launch').addEventListener('click', () => {
    const win = window.open('about:blank', '_blank');
    if (!win || win.closed) {
      window.alert('Popup blocked. Allow popups for this site and try again.');
      return;
    }
    try {
      const doc = win.document;
      doc.title = 'Space Simulator';
      doc.documentElement.style.height = '100%';
      doc.body.style.cssText = 'margin:0;padding:0;height:100%;background:#000;overflow:hidden';
      const iframe = doc.createElement('iframe');
      iframe.src = window.location.href;
      iframe.setAttribute('allow', 'fullscreen');
      iframe.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0');
      doc.body.appendChild(iframe);
    } catch (err) {
      window.alert('Could not embed in about:blank: ' + err.message);
      return;
    }
    setOpen(false);
  });

  return { root: panel, button: btn, setOpen };
}
