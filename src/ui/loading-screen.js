export function createLoadingScreen() {
  const root = document.getElementById('loading-screen');
  root.innerHTML = `
    <div class="ls-inner">
      <div class="ls-title">Space Simulator</div>
      <div class="ls-bar"><div class="ls-bar-fill"></div></div>
      <div class="ls-status">Loading…</div>
    </div>`;
  const fill = root.querySelector('.ls-bar-fill');
  const status = root.querySelector('.ls-status');

  function setProgress(p) {
    const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
    fill.style.width = pct + '%';
    status.textContent = pct + '%';
  }

  function showError(msg) {
    root.querySelector('.ls-bar').remove();
    status.remove();
    const err = document.createElement('div');
    err.className = 'ls-error';
    err.textContent = `Failed to load: ${msg}. Reload to try again.`;
    root.querySelector('.ls-inner').appendChild(err);
  }

  function fadeOut() {
    root.classList.add('ls-fading');
    return new Promise((resolve) => setTimeout(() => {
      root.classList.add('ls-hidden');
      resolve();
    }, 600));
  }

  return { setProgress, showError, fadeOut };
}
