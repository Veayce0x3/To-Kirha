import { forceAppRefresh } from '../core/reload.js';

const THRESHOLD_PX = 90;
const HINT_NEAR_PX = 8;

/**
 * Tire vers le bas en haut de page → hard-refresh (mobile + molette).
 * Indicateur en overlay (hors flux flex) pour ne pas casser le layout.
 * @param {HTMLElement} scrollEl — `.content-wrapper`
 * @param {object} game
 */
export function initBottomPullRefresh(scrollEl, game) {
  if (!scrollEl || scrollEl.dataset.pullRefreshBound === '1') return;
  scrollEl.dataset.pullRefreshBound = '1';

  const indicator = document.createElement('div');
  indicator.className = 'top-pull-refresh';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML = `
    <div class="top-pull-refresh-inner">
      <span class="top-pull-refresh-icon" aria-hidden="true">↓</span>
      <span class="top-pull-refresh-label">Tire vers le bas pour actualiser</span>
    </div>
  `;
  scrollEl.appendChild(indicator);

  const labelEl = indicator.querySelector('.top-pull-refresh-label');
  const iconEl = indicator.querySelector('.top-pull-refresh-icon');
  let startY = 0;
  let pulling = false;
  let pullDist = 0;
  let armed = false;
  let refreshing = false;
  let wheelAcc = 0;
  let wheelResetTimer = 0;

  function atTop() {
    return scrollEl.scrollTop <= HINT_NEAR_PX;
  }

  function setPullUI(dist) {
    const progress = Math.min(1, dist / THRESHOLD_PX);
    indicator.style.setProperty('--pull', String(progress));
    indicator.classList.toggle('visible', dist > 6);
    indicator.classList.toggle('armed', dist >= THRESHOLD_PX);
    if (labelEl) {
      labelEl.textContent = dist >= THRESHOLD_PX
        ? 'Relâche pour actualiser'
        : 'Continue de tirer…';
    }
    if (iconEl) {
      iconEl.textContent = dist >= THRESHOLD_PX ? '↻' : '↓';
    }
  }

  function resetUI() {
    pullDist = 0;
    wheelAcc = 0;
    armed = false;
    indicator.classList.remove('visible', 'armed', 'refreshing');
    indicator.style.setProperty('--pull', '0');
    if (labelEl) labelEl.textContent = 'Tire vers le bas pour actualiser';
    if (iconEl) iconEl.textContent = '↓';
  }

  async function triggerRefresh() {
    if (refreshing) return;
    refreshing = true;
    indicator.classList.add('visible', 'refreshing', 'armed');
    if (labelEl) labelEl.textContent = 'Actualisation…';
    if (iconEl) iconEl.textContent = '↻';
    try {
      await forceAppRefresh(game);
    } catch {
      window.location.reload();
    }
  }

  scrollEl.addEventListener('touchstart', (e) => {
    if (refreshing || !atTop()) return;
    startY = e.touches[0].clientY;
    pulling = true;
    pullDist = 0;
    armed = false;
  }, { passive: true });

  scrollEl.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    // Doigt vers le bas = tire depuis le haut
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || !atTop()) {
      pullDist = 0;
      setPullUI(0);
      return;
    }
    pullDist = Math.min(dy, THRESHOLD_PX * 1.4);
    armed = pullDist >= THRESHOLD_PX;
    setPullUI(pullDist);
  }, { passive: true });

  scrollEl.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    if (armed && !refreshing) {
      triggerRefresh();
      return;
    }
    resetUI();
  }, { passive: true });

  scrollEl.addEventListener('touchcancel', () => {
    pulling = false;
    resetUI();
  }, { passive: true });

  // Desktop : molette vers le haut en haut de page
  scrollEl.addEventListener('wheel', (e) => {
    if (refreshing || e.deltaY >= 0 || !atTop()) {
      wheelAcc = 0;
      return;
    }
    wheelAcc += -e.deltaY;
    setPullUI(Math.min(wheelAcc, THRESHOLD_PX * 1.2));
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      if (!refreshing) resetUI();
    }, 400);
    if (wheelAcc >= THRESHOLD_PX * 1.5) {
      window.clearTimeout(wheelResetTimer);
      triggerRefresh();
    }
  }, { passive: true });
}
