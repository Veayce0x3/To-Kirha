import { forceAppRefresh } from '../core/reload.js';

const THRESHOLD_PX = 90;
const HINT_NEAR_PX = 24;

/**
 * Tire vers le haut en bas de page → hard-refresh (mobile + molette).
 * @param {HTMLElement} scrollEl — `.content-wrapper`
 * @param {object} game
 */
export function initBottomPullRefresh(scrollEl, game) {
  if (!scrollEl || scrollEl.dataset.pullRefreshBound === '1') return;
  scrollEl.dataset.pullRefreshBound = '1';

  const indicator = document.createElement('div');
  indicator.className = 'bottom-pull-refresh';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML = `
    <div class="bottom-pull-refresh-inner">
      <span class="bottom-pull-refresh-icon" aria-hidden="true">🔄</span>
      <span class="bottom-pull-refresh-label">Tire pour actualiser</span>
    </div>
  `;
  scrollEl.appendChild(indicator);

  const labelEl = indicator.querySelector('.bottom-pull-refresh-label');
  let startY = 0;
  let pulling = false;
  let pullDist = 0;
  let armed = false;
  let refreshing = false;
  let wheelAcc = 0;

  function atBottom() {
    return scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - HINT_NEAR_PX;
  }

  function setPullUI(dist) {
    const progress = Math.min(1, dist / THRESHOLD_PX);
    indicator.style.setProperty('--pull', String(progress));
    indicator.classList.toggle('visible', dist > 8 || atBottom());
    indicator.classList.toggle('armed', dist >= THRESHOLD_PX);
    if (labelEl) {
      labelEl.textContent = dist >= THRESHOLD_PX
        ? 'Relâche pour actualiser'
        : atBottom() && dist <= 8
          ? 'Tire vers le bas pour actualiser'
          : 'Continue de tirer…';
    }
  }

  function resetUI() {
    pullDist = 0;
    wheelAcc = 0;
    armed = false;
    indicator.classList.remove('armed', 'refreshing');
    indicator.style.setProperty('--pull', '0');
    if (atBottom()) {
      indicator.classList.add('visible');
      if (labelEl) labelEl.textContent = 'Tire vers le bas pour actualiser';
    } else {
      indicator.classList.remove('visible');
    }
  }

  async function triggerRefresh() {
    if (refreshing) return;
    refreshing = true;
    indicator.classList.add('visible', 'refreshing', 'armed');
    if (labelEl) labelEl.textContent = 'Actualisation…';
    try {
      await forceAppRefresh(game);
    } catch {
      window.location.reload();
    }
  }

  scrollEl.addEventListener('scroll', () => {
    if (refreshing || pulling) return;
    if (atBottom()) {
      indicator.classList.add('visible');
      if (labelEl && pullDist < 8) labelEl.textContent = 'Tire vers le bas pour actualiser';
    } else {
      resetUI();
    }
  }, { passive: true });

  scrollEl.addEventListener('touchstart', (e) => {
    if (refreshing || !atBottom()) return;
    startY = e.touches[0].clientY;
    pulling = true;
    pullDist = 0;
    armed = false;
  }, { passive: true });

  scrollEl.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    // Doigt vers le haut = tire le contenu du bas
    const dy = startY - e.touches[0].clientY;
    if (dy <= 0 || !atBottom()) {
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

  // Desktop : molette en bas de page
  scrollEl.addEventListener('wheel', (e) => {
    if (refreshing || e.deltaY <= 0 || !atBottom()) {
      wheelAcc = 0;
      return;
    }
    wheelAcc += e.deltaY;
    setPullUI(Math.min(wheelAcc, THRESHOLD_PX * 1.2));
    if (wheelAcc >= THRESHOLD_PX * 1.5) {
      triggerRefresh();
    }
  }, { passive: true });
}
