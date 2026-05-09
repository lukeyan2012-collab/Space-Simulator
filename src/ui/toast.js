export function createToaster() {
  const root = document.createElement('div');
  root.className = 'toaster';
  document.body.appendChild(root);
  const recent = new Set();

  function show(msg) {
    if (!msg || recent.has(msg)) return;
    recent.add(msg);
    setTimeout(() => recent.delete(msg), 5000);
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  return { show };
}
