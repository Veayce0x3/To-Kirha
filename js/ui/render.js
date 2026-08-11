import { getSeasonBonusPercents, hasSeasonBonus, isSeasonBoostActive, getSeasonBoostRemainingMs, canActivateSeasonBoost } from '../systems/prestige.js';
import { on } from '../core/events.js';
import { focusAchievementInChain } from '../systems/achievements.js';
import { cleanupPullRefreshArtifacts } from './pullRefresh.js';
import { RARITY_LABELS } from '../systems/equipmentRarity.js';
import { getNavIcon, getCategoryIcon, getJobIcon, iconHtml, UI, renderResourceIcon } from '../core/assets.js';
import {
  navigate,
  getView,
  getViewTitle,
  getNavCategories,
  isCategoryCollapsed,
  toggleCategory,
  SIDEBAR_FOOTER,
  VIEWS,
  JOB_VIEW_MAP,
  isFarmView,
  setNavigateGuard,
  isWorkshopView,
} from './router.js';
import { isRecipeEquipped } from '../systems/equipment.js';
import { initCareerChoiceModal, showCareerChoiceIfNeeded } from './careerChoiceUi.js';
import { initAuthModal, showAuthModalIfNeeded, showAccountRequiredModal } from './authUi.js';
import { canUseOnlineFeatures, getOnlineBlockReason, canSeeAdminPanel } from '../core/auth.js';
import { getFeatureUnlockProgress, getUnlockedGatheringJobs } from '../systems/careerChoice.js';
import {
  shouldShowWhatsNew,
  getWhatsNewEntries,
  getChangelogSeenBuildId,
  getAppBuildId,
  markChangelogSeen,
} from '../core/startupRefresh.js';
import {
  renderView,
  renderJobSwitcherDock,
  updateJobSwitcherDockStatus,
  showOfflineModal,
  showDungeonResult,
  initSakuraPetals,
  formatNumber,
  refreshCharToolsIfVisible,
  refreshCharacterCombatPanels,
  openDungeonCombatModal,
  refreshDungeonCombatModal,
  closeDungeonCombatModal,
  setAuctionMainMode,
  updateHarvestSlotProgresses,
  updateFarmSlotProgresses,
  patchFarmSlot,
  patchFarmBuildingSlots,
  syncStaleFarmSlots,
  patchHarvestSlot,
  flashHarvestSlotReady,
  playHarvestSlotFx,
  closeCharEquipPickerSheet,
  closeAllResourcePickers,
  isResourcePickerOpen,
  refreshJobViewLight,
  refreshFarmViewLight,
  shouldPartialRefreshOnStateChange,
  refreshAuctionHouseLight,
} from './views.js';
import { clearSchoolTimer } from './villageSchoolView.js';
import { showFirstVisitHint } from './firstVisitHints.js';
import { syncSakuraWindVisual } from './villageView.js';
import { patchFarmUnitCard } from './productionLineView.js';

export function initUI(game, audio) {
  initSakuraPetals();
  initCareerChoiceModal(game);

  setNavigateGuard((viewId) => {
    if (!game.needsCareerChoice()) {
      if (viewId === 'leaderboard' && !canUseOnlineFeatures()) {
        showAccountRequiredModal(getOnlineBlockReason());
        return false;
      }
      if (viewId === 'admin' && !canSeeAdminPanel()) {
        return false;
      }
      return true;
    }
    return viewId === 'character' || viewId === 'season' || viewId === 'options' || (viewId === 'admin' && canSeeAdminPanel());
  });

  const els = {
    kirha: document.getElementById('kirha-amount'),
    scrollAmount: document.getElementById('scroll-amount'),
    goldNuggetAmount: document.getElementById('gold-nugget-amount'),
    quickScroll: document.getElementById('quick-scroll'),
    seasonBadge: document.getElementById('season-badge'),
    seasonBonusChip: document.getElementById('season-bonus-chip'),
    seasonBoostChip: document.getElementById('season-boost-chip'),
    viewTitle: document.getElementById('view-title'),
    zoneSubtitle: document.getElementById('zone-subtitle'),
    viewContainer: document.getElementById('view-container'),
    jobSwitcherDock: document.getElementById('job-switcher-dock'),
    sidebar: document.getElementById('sidebar'),
    sidebarNav: document.getElementById('sidebar-nav'),
    sidebarFooter: document.getElementById('sidebar-footer'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    burgerBtn: document.getElementById('burger-btn'),
    quickOptions: document.getElementById('quick-options'),
    objectiveBanner: document.getElementById('objective-banner'),
    toasts: document.getElementById('toasts'),
    levelFlash: document.getElementById('level-flash'),
    offlineModal: document.getElementById('offline-modal'),
    offlineDuration: document.getElementById('offline-duration'),
    offlineGains: document.getElementById('offline-gains'),
    offlineCap: document.getElementById('offline-cap'),
    offlineClose: document.getElementById('offline-close'),
    prestigeModal: document.getElementById('prestige-modal'),
    prestigeGains: document.getElementById('prestige-gains'),
    prestigeCancel: document.getElementById('prestige-cancel'),
    prestigeConfirm: document.getElementById('prestige-confirm'),
    whatsNewModal: document.getElementById('whats-new-modal'),
    whatsNewTitle: document.getElementById('whats-new-title'),
    whatsNewDesc: document.getElementById('whats-new-desc'),
    whatsNewVersion: document.getElementById('whats-new-version'),
    whatsNewBody: document.getElementById('whats-new-body'),
    whatsNewConfirm: document.getElementById('whats-new-confirm'),
    travelingMerchantModal: document.getElementById('traveling-merchant-modal'),
    travelingMerchantGoto: document.getElementById('traveling-merchant-goto'),
    travelingMerchantDismiss: document.getElementById('traveling-merchant-dismiss'),
  };

  let lastKirha = game.state.kirha;

  function openSidebar() {
    els.sidebar?.classList.add('open');
    els.sidebarOverlay?.classList.add('active');
  }

  function closeSidebar() {
    els.sidebar?.classList.remove('open');
    els.sidebarOverlay?.classList.remove('active');
  }

  function createNavBtn(viewId, showLevel = true) {
    const view = VIEWS[viewId];
    if (!view) return null;

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.view = viewId;

    let levelHtml = '';
    if (showLevel && view.job) {
      levelHtml = `<span class="nav-level">${game.getJobLevel(view.job)}</span>`;
    } else if (showLevel && view.building) {
      const lv = view.building === 'well'
        ? '—'
        : String(game.getFarmBuildingLevel(view.building) || 1);
      levelHtml = `<span class="nav-level">${lv}</span>`;
    } else if (showLevel && viewId === 'character') {
      levelHtml = `<span class="nav-level">${game.getCharacterProgress().level}</span>`;
    }

    const navIcon = getNavIcon(viewId) || (view.job ? getJobIcon(view.job) : null);
    const iconPart = navIcon
      ? iconHtml(navIcon, 'nav-icon', view.label)
      : (view.emoji ? `<span class="nav-emoji">${view.emoji}</span>` : '');

    const statusDot = (view.job || view.building || viewId === 'achievements')
      ? '<span class="nav-status-dot" aria-hidden="true"></span>'
      : '';

    btn.innerHTML = `
      ${iconPart}
      <span class="nav-label">${view.label}</span>
      ${statusDot}
      ${levelHtml}
    `;
    btn.addEventListener('click', () => {
      closeSidebar();
      navigate(viewId);
    });
    return btn;
  }

  function getLockedFeatureNavEntry(viewId) {
    if (viewId === 'village') {
      if (game.isVillageBoardUnlocked?.()) return null;
      return {
        featureId: 'village_board',
        viewId: 'village',
        label: 'Village',
        emoji: '🏘️',
        ready: false,
        progress: 0,
        hint: 'École → Connaissances : Conseil du village.',
        gates: [{ type: 'schoolUnlock', ready: false, jobName: 'Conseil du village' }],
      };
    }
    if (viewId === 'village_school') {
      if (game.isVillageSchoolUnlocked?.()) return null;
      return {
        featureId: 'village_school',
        viewId: 'village_school',
        label: 'École du Village',
        emoji: '🏫',
        ready: false,
        progress: 0,
        hint: game.balance?.jobUnlocks?.toolmaker?.hint || 'École → Atelier : Atelier de l’Outilleur.',
        gates: [{ type: 'schoolUnlock', ready: false, jobName: 'Outilleur' }],
      };
    }
    const featureByView = { combat: 'combat', workshop: 'toolmaker', cuisine: 'baker' };
    const featureId = featureByView[viewId];
    if (!featureId) return null;
    if (featureId === 'combat' && game.isCombatViewUnlocked()) return null;
    if (featureId === 'toolmaker' && game.isCraftUnlocked()) return null;
    if (featureId === 'baker' && (game.isCuisineUnlocked?.() || game.isCookUnlocked())) return null;
    return getFeatureUnlockProgress(featureId, game.state, game.balance, game.jobs);
  }

  function formatLockedNavMeta(entry) {
    if (entry.ready) return 'Prêt !';
    if (entry.gates?.length) {
      const pending = entry.gates.find((gate) => !gate.ready);
      if (!pending) return 'Prêt !';
      if (pending.type === 'jobLevel') {
        return `${pending.jobName} Nv.${pending.currentLevel}/${pending.requiredLevel}`;
      }
      if (pending.type === 'characterLevel') {
        return `Perso Nv.${pending.currentLevel}/${pending.requiredLevel}`;
      }
      if (pending.type === 'totalHarvests') {
        return `${pending.currentLevel}/${pending.requiredLevel} récoltes`;
      }
      if (pending.type === 'buildingLevel') {
        const name = pending.buildingName || pending.jobName || 'Bâtiment';
        return `${name} Nv.${pending.currentLevel}/${pending.requiredLevel}`;
      }
      if (pending.type === 'building') {
        if (pending.requiredLevel != null) {
          return `${pending.buildingName} Nv.${pending.currentLevel}/${pending.requiredLevel}`;
        }
        return `${pending.buildingName} 🔒`;
      }
      if (pending.type === 'craftJobUnlocked') {
        return pending.jobName || 'Outilleur';
      }
      if (pending.type === 'schoolUnlock') {
        return pending.jobName || 'École du Village';
      }
    }
    const gateName = game.jobs[entry.gateJob]?.name || entry.gateJob;
    if (entry.currentLevel == null || entry.requiredLevel == null) {
      return entry.hint || 'Se débloque plus tard';
    }
    return entry.gateJob
      ? `${gateName} Nv.${entry.currentLevel}/${entry.requiredLevel}`
      : `Nv.${entry.currentLevel}/${entry.requiredLevel}`;
  }

  function createLockedNavBtn(entry) {
    const pct = Math.floor((entry.progress || 0) * 100);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nav-btn nav-btn-locked${entry.ready ? ' nav-btn-unlock-ready' : ''}`;
    btn.dataset.view = entry.viewId;
    btn.title = entry.hint || formatLockedNavMeta(entry);

    const navIcon = entry.featureId
      ? (getNavIcon(entry.viewId) || null)
      : getJobIcon(entry.jobId);
    const iconPart = navIcon
      ? iconHtml(navIcon, 'nav-icon nav-icon-locked', entry.label)
      : `<span class="nav-emoji">${entry.emoji}</span>`;

    btn.innerHTML = `
      ${iconPart}
      <span class="nav-label">${entry.label}</span>
      <span class="nav-lock-meta">${formatLockedNavMeta(entry)}</span>
      <div class="nav-unlock-bar"><div class="nav-unlock-fill" style="width:${pct}%"></div></div>
    `;
    btn.addEventListener('click', () => {
      closeSidebar();
      navigate(entry.viewId);
    });
    return btn;
  }

  function syncJobUnlockToasts() {
    const current = getUnlockedGatheringJobs(game.state, game.balance);
    if (knownUnlockedGathering === null) {
      knownUnlockedGathering = [...current];
      return;
    }
    for (const id of current) {
      if (!knownUnlockedGathering.includes(id)) {
        const job = game.jobs[id];
        showToast(els, `🔓 ${job?.name || id} débloqué !`, 'levelup');
        unseenViews.add(JOB_VIEW_MAP[id] || `job_${id}`);
        els.levelFlash?.classList.add('active');
        setTimeout(() => els.levelFlash?.classList.remove('active'), 600);
        buildNav();
        updateNavActive();
      }
    }
    knownUnlockedGathering = [...current];
  }

  let knownUnlockedGathering = null;

  function buildNav() {
    els.sidebarNav.innerHTML = '';
    els.sidebarFooter.innerHTML = '';

    for (const cat of getNavCategories(game.state, game.balance, game.jobs)) {
      const section = document.createElement('div');
      section.className = 'nav-category';

      const header = document.createElement('div');
      header.className = 'nav-cat-header';
      const catIcon = getCategoryIcon(cat.id);
      const catLabel = catIcon
        ? `<span class="nav-cat-label">${iconHtml(catIcon, 'nav-cat-icon', cat.label)}<span>${cat.label}</span></span>`
        : `<span>${cat.label}</span>`;
      header.innerHTML = catLabel;

      if (cat.collapsible) {
        const toggle = document.createElement('button');
        toggle.className = 'nav-cat-toggle';
        toggle.type = 'button';
        toggle.textContent = isCategoryCollapsed(cat.id) ? '👁️‍🗨️' : '👁️';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleCategory(cat.id);
          buildNav();
          updateNavActive();
        });
        header.appendChild(toggle);
      }

      section.appendChild(header);

      const items = document.createElement('div');
      items.className = `nav-cat-items${isCategoryCollapsed(cat.id) ? ' collapsed' : ''}`;

      for (const item of cat.items) {
        if (item?.kind === 'lockedJob') {
          items.appendChild(createLockedNavBtn(item.entry));
          continue;
        }
        const viewId = item?.viewId || item;
        const lockedFeature = getLockedFeatureNavEntry(viewId);
        if (lockedFeature) {
          items.appendChild(createLockedNavBtn(lockedFeature));
          continue;
        }
        const btn = createNavBtn(viewId);
        if (btn) items.appendChild(btn);
      }

      section.appendChild(items);
      els.sidebarNav.appendChild(section);
    }

    for (const viewId of SIDEBAR_FOOTER) {
      const btn = createNavBtn(viewId, false);
      if (btn) els.sidebarFooter.appendChild(btn);
    }
    // Admin toujours en bas du menu si droits (re-check live à chaque buildNav)
    if (canSeeAdminPanel()) {
      const adminBtn = createNavBtn('admin', false);
      if (adminBtn) {
        adminBtn.classList.add('nav-admin-btn');
        adminBtn.title = 'Administration';
        els.sidebarFooter.appendChild(adminBtn);
      }
    }
  }

  const HARVEST_NAV_CLASSES = [
    'nav-active-harvest',
    'nav-harvest-ready',
    'nav-harvest-harvesting',
    'nav-harvest-regrowing',
    'nav-harvest-empty',
    'nav-achievement-ready',
  ];

  function updateNavActive() {
    const view = getView();
    const claimable = game.getClaimableAchievementCount?.() || 0;
    const currentObj = game.getCurrentObjective?.();
    const objTargetView = currentObj?.hintView
      || (currentObj?.hintJob ? (JOB_VIEW_MAP[currentObj.hintJob] || null) : null);

    if (els.burgerBtn) {
      const ready = claimable > 0;
      const hasObj = !!objTargetView && objTargetView !== view;
      els.burgerBtn.classList.toggle('burger-achievement-ready', ready);
      els.burgerBtn.classList.toggle('burger-objective-pulse', hasObj && !ready);
      if (ready) {
        els.burgerBtn.title = `Menu — ${claimable} succès à récupérer`;
        els.burgerBtn.setAttribute('aria-label', `Menu, ${claimable} succès à récupérer`);
      } else if (hasObj) {
        els.burgerBtn.title = `Menu — Objectif : ${currentObj.title}`;
        els.burgerBtn.setAttribute('aria-label', `Menu, objectif en cours`);
      } else {
        els.burgerBtn.title = 'Menu';
        els.burgerBtn.setAttribute('aria-label', 'Menu');
      }
    }

    document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
      const vid = btn.dataset.view;
      btn.classList.toggle('active', vid === view);
      btn.classList.remove(...HARVEST_NAV_CLASSES);
      delete btn.dataset.harvestStatus;

      if (vid === 'achievements') {
        if (claimable > 0) {
          btn.classList.add('nav-achievement-ready');
          btn.dataset.harvestStatus = 'ready';
          btn.title = `${claimable} succès à récupérer`;
        } else {
          btn.title = 'Succès';
        }
        return;
      }

      const viewDef = VIEWS[vid];
      if (viewDef?.job) {
        const status = game.getJobHarvestNavStatus(viewDef.job);
        btn.dataset.harvestStatus = status;
        btn.classList.add(`nav-harvest-${status}`);
        return;
      }
      if (viewDef?.building) {
        const status = game.getFarmBuildingNavStatus(viewDef.building);
        btn.dataset.harvestStatus = status;
        btn.classList.add(`nav-harvest-${status}`);
      }

      if (unseenViews.has(vid)) {
        btn.classList.add('nav-unseen');
      } else {
        btn.classList.remove('nav-unseen');
      }

      btn.classList.toggle('nav-objective-target', vid === objTargetView && vid !== view);

      if (vid === 'auction_house') {
        const tm = !!game.isTravelingMerchantActive?.();
        btn.classList.toggle('nav-tm-active', tm);
        if (tm) btn.title = 'Place marchande — Marchand itinérant présent !';
      }
    });
    updateJobSwitcherDockStatus(game);
  }

  function refreshView() {
    closeAllResourcePickers();
    closeCharEquipPickerSheet();
    const view = getView();
    lastRenderedView = view;
    renderView(game, els.viewContainer, view);
    renderJobSwitcherDock(game, els.jobSwitcherDock, view);
    updateNavActive();
    if (els.viewContainer && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      els.viewContainer.classList.remove('view-enter');
      void els.viewContainer.offsetWidth;
      els.viewContainer.classList.add('view-enter');
      setTimeout(() => els.viewContainer?.classList.remove('view-enter'), 320);
    }
  }

  let objectiveBannerCollapsed = false;
  let lastObjectiveSource = null;

  function refreshObjectiveBanner() {
    const banner = els.objectiveBanner;
    if (!banner) return;
    if (!game.state?.careerChoice?.confirmed) {
      banner.classList.add('hidden');
      return;
    }
    if (game.state.settings?.hideObjectiveBanner) {
      banner.classList.add('hidden');
      return;
    }
    const obj = game.getCurrentObjective();
    if (!obj) {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');

    if (obj.source !== lastObjectiveSource) {
      objectiveBannerCollapsed = false;
      lastObjectiveSource = obj.source;
    }

    const stepsHtml = obj.steps?.length
      ? `<ol class="obj-steps${objectiveBannerCollapsed ? ' hidden' : ''}">${obj.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`
      : '';

    banner.innerHTML = `
      <div class="obj-banner-head">
        <span class="obj-banner-icon">🎯</span>
        <div class="obj-banner-text">
          <strong class="obj-banner-title">${obj.title}</strong>
          <span class="obj-banner-desc">${obj.description}</span>
        </div>
        <div class="obj-banner-actions">
          ${obj.hintView || obj.hintJob ? '<button type="button" class="btn btn-craft btn-small obj-go">Y aller →</button>' : ''}
          ${obj.steps?.length ? `<button type="button" class="btn btn-muted btn-small obj-toggle" aria-label="Détails">${objectiveBannerCollapsed ? '▼' : '▲'}</button>` : ''}
        </div>
      </div>
      ${stepsHtml}
    `;

    banner.querySelector('.obj-go')?.addEventListener('click', () => {
      if (obj.hintView) navigate(obj.hintView === 'workshop' ? 'workshop' : obj.hintView);
      else if (obj.hintJob) navigate(JOB_VIEW_MAP[obj.hintJob] || 'world');
    });
    banner.querySelector('.obj-toggle')?.addEventListener('click', () => {
      objectiveBannerCollapsed = !objectiveBannerCollapsed;
      refreshObjectiveBanner();
    });
  }

  function refreshHeader(state) {
    if (state.kirha !== lastKirha) {
      els.kirha.classList.add('pulse');
      setTimeout(() => els.kirha.classList.remove('pulse'), 400);
      lastKirha = state.kirha;
    }
    els.kirha.textContent = formatNumber(state.kirha);
    if (els.scrollAmount) els.scrollAmount.textContent = formatNumber(game.getScrollCount());
    if (els.goldNuggetAmount) els.goldNuggetAmount.textContent = formatNumber(game.getGoldNuggetCount());

    const season = state.season || 1;
    const { kirhaPct, xpPct, jobXpPct, regrowthPct } = getSeasonBonusPercents(state);
    if (els.seasonBadge) {
      if (hasSeasonBonus(state)) {
        const bits = [];
        if (kirhaPct > 0) bits.push(`+${kirhaPct}% 💰`);
        if (jobXpPct > 0) bits.push(`+${jobXpPct}% métiers`);
        if (regrowthPct > 0) bits.push(`+${regrowthPct}% ⏱`);
        els.seasonBadge.innerHTML = `Saison ${season}<span class="season-badge-bonus">${bits.join(' · ')}</span>`;
      } else {
        els.seasonBadge.textContent = `Saison ${season}`;
      }
    }
    if (els.seasonBonusChip) {
      if (hasSeasonBonus(state)) {
        els.seasonBonusChip.hidden = false;
        const vals = [];
        if (kirhaPct > 0) vals.push(`+${kirhaPct}% 💰`);
        if (xpPct > 0) vals.push(`+${xpPct}% perso`);
        if (jobXpPct > 0) vals.push(`+${jobXpPct}% métiers`);
        if (regrowthPct > 0) vals.push(`+${regrowthPct}% ⏱`);
        els.seasonBonusChip.innerHTML = `<span class="season-bonus-chip-label">S${season}</span><span class="season-bonus-chip-vals">${vals.join(' · ')}</span>`;
        els.seasonBonusChip.title = `Bonus saison : ${vals.join(' · ')}`;
      } else {
        els.seasonBonusChip.hidden = true;
        els.seasonBonusChip.innerHTML = '';
      }
    }
    if (els.seasonBoostChip) {
      if (isSeasonBoostActive(state)) {
        const mins = Math.max(1, Math.ceil(getSeasonBoostRemainingMs(state) / 60000));
        els.seasonBoostChip.hidden = false;
        els.seasonBoostChip.textContent = `⚡ ×2 · ${mins} min`;
        els.seasonBoostChip.title = 'Boost temporaire actif : XP ×2, ventes ×2, repousse ÷2';
        els.seasonBoostChip.dataset.boostAction = 'status';
      } else if (canActivateSeasonBoost(state, game.balance).ok) {
        els.seasonBoostChip.hidden = false;
        els.seasonBoostChip.textContent = '⚡ Activer ×2';
        els.seasonBoostChip.title = 'Activer le boost de démarrage ×2 (1 h)';
        els.seasonBoostChip.dataset.boostAction = 'activate';
      } else {
        els.seasonBoostChip.hidden = true;
        els.seasonBoostChip.textContent = '';
        els.seasonBoostChip.dataset.boostAction = '';
      }
    }

    els.viewTitle.textContent = getViewTitle();
    const zone = game.getCurrentZone();
    els.zoneSubtitle.textContent = zone ? `${zone.emoji} ${zone.name}` : '';
  }

  let animTimer = null;
  let lastNavTickAt = 0;
  const PROGRESS_TICK_MS = 1000;
  const NAV_TICK_MS = 2000;

  function stopProgressTick() {
    if (animTimer != null) {
      clearTimeout(animTimer);
      animTimer = null;
    }
  }

  function tickActiveUI() {
    animTimer = null;
    if (document.hidden) return;

    const harvesting = game.isHarvesting();
    const farming = game.isFarmActive();
    if (harvesting) updateHarvestSlotProgresses(game);
    if (farming) updateFarmSlotProgresses(game);
    syncSakuraWindVisual(game);

    if (!harvesting && !farming) {
      // Garde un tick léger pour démarrer/arrêter les pétales Vent des cerisiers
      animTimer = setTimeout(tickActiveUI, 5000);
      return;
    }

    const now = Date.now();
    if (now - lastNavTickAt >= NAV_TICK_MS) {
      updateNavActive();
      lastNavTickAt = now;
    }

    animTimer = setTimeout(tickActiveUI, PROGRESS_TICK_MS);
  }

  function tickHarvestUI() {
    if (document.hidden) return;
    if (animTimer != null) return;
    tickActiveUI();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopProgressTick();
      document.body.classList.add('page-hidden');
    } else {
      document.body.classList.remove('page-hidden');
      game.pullAdminPatch?.().then((changed) => {
        if (changed) {
          refreshHeader(game.state);
          refreshView();
        }
      }).catch(() => {});
      if ((game.isHarvesting() || game.isFarmActive()) && animTimer == null) {
        tickHarvestUI();
      }
    }
  });

  function showWhatsNewIfNeeded() {
    document.body.classList.remove('startup-refresh-pending');
    const modal = els.whatsNewModal;
    if (!modal) return;

    if (!shouldShowWhatsNew(game.balance)) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      return;
    }

    const current = getAppBuildId(game.balance);
    const since = getChangelogSeenBuildId();
    const entries = getWhatsNewEntries(game.changelog, since, current);
    if (!entries.length) {
      markChangelogSeen(game.balance);
      return;
    }

    const latest = entries[0];
    if (els.whatsNewTitle) els.whatsNewTitle.textContent = `✨ ${latest.title || 'Nouveautés'}`;
    if (els.whatsNewDesc) {
      els.whatsNewDesc.textContent = entries.length > 1
        ? `${entries.length} mises à jour depuis ta dernière session.`
        : 'Voici ce qui a changé dans cette version.';
    }
    if (els.whatsNewVersion) els.whatsNewVersion.textContent = `Build ${current}`;

    if (els.whatsNewBody) {
      els.whatsNewBody.innerHTML = entries.map((entry) => {
        const highlights = (entry.highlights || []).map((h) => `<li>${h}</li>`).join('');
        const date = entry.date ? `<p class="whats-new-date">${entry.date}</p>` : '';
        const heading = entries.length > 1
          ? `<h3 class="whats-new-entry-title">${entry.title || entry.buildId}</h3>`
          : '';
        return `<section class="whats-new-entry">${heading}${date}<ul class="whats-new-list">${highlights}</ul></section>`;
      }).join('');
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  buildNav();
  syncJobUnlockToasts();

  els.burgerBtn?.addEventListener('click', openSidebar);
  els.sidebarOverlay?.addEventListener('click', closeSidebar);
  els.quickOptions?.addEventListener('click', () => navigate('options'));
  els.quickScroll?.addEventListener('click', () => navigate('auction_house'));
  els.seasonBadge?.addEventListener('click', () => navigate('season'));
  els.seasonBadge?.setAttribute('role', 'button');
  els.seasonBadge?.setAttribute('tabindex', '0');
  els.seasonBadge?.setAttribute('title', 'Voir la saison');
  els.seasonBadge?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate('season');
    }
  });
  els.seasonBonusChip?.addEventListener('click', () => navigate('season'));
  els.seasonBoostChip?.addEventListener('click', () => {
    if (els.seasonBoostChip?.dataset.boostAction === 'activate') {
      if (!confirm('Activer le boost ×2 pour 1 heure ?\n(Une seule fois — Confirmer pour lancer.)')) return;
      const result = game.activateSeasonBoost();
      if (result?.ok) {
        refreshHeader(game.state);
        refreshView();
      }
      return;
    }
    navigate('character');
  });

  on('sidebarClose', closeSidebar);

  els.offlineClose.addEventListener('click', () => els.offlineModal.classList.remove('active'));
  els.prestigeCancel.addEventListener('click', () => els.prestigeModal.classList.remove('active'));
  els.prestigeConfirm.addEventListener('click', () => {
    if (game.doPrestige()) {
      els.prestigeModal.classList.remove('active');
      audio.playSfx('prestige');
      navigate('character');
      buildNav();
      updateNavActive();
      refreshView();
      refreshHeader(game.state);
      // Reset complet → rechoisir l’arme pour débloquer les métiers
      showCareerChoiceIfNeeded(game);
    }
  });

  document.addEventListener('tokirha:prestige-open', () => {
    const info = game.getPrestigeInfo();
    const caps = info.caps;
    const nextSeasonEl = document.getElementById('prestige-modal-next-season');
    if (nextSeasonEl) nextSeasonEl.textContent = info.nextSeason;
    const capLine = caps
      ? `<div class="prestige-gain-row">📈 Saison ${info.nextSeason} : perso Nv.${caps.nextSeason.character} · métiers Nv.${caps.nextSeason.jobs}</div>`
      : '';
    els.prestigeGains.innerHTML = `
      ${capLine}
      <div class="prestige-gain-row">✅ Conservé : compte, pseudo, succès, stats de vie, bonus %</div>
      <div class="prestige-gain-row">🔄 Remis à zéro : métiers, inventaire, ferme, équipe</div>
      <div class="prestige-gain-row">✨ Pépites requises consommées · surplus conservé</div>
      <div class="prestige-gain-row">💰 Départ saison : ${info.seasonStartKirha} 💰</div>
      <div class="prestige-gain-row">⚡ Boost ×2 (1 h) à activer quand tu veux (tant que Nv.≤10)</div>
      <div class="prestige-gain-row">💰 Kirha : +${info.nextBonuses.kirha.toFixed(0)}% total (+${info.gainBonuses.kirha.toFixed(0)}%/saison)</div>
      <div class="prestige-gain-row">🧘 XP perso : +${info.nextBonuses.xp.toFixed(0)}% total (+${info.gainBonuses.xp.toFixed(0)}%/saison)</div>
      <div class="prestige-gain-row">🛠️ XP métiers : +${info.nextBonuses.jobXp.toFixed(0)}% total (+${info.gainBonuses.jobXp.toFixed(0)}%/saison)</div>
      <div class="prestige-gain-row">🌱 Repousse : +${info.nextBonuses.regrowth.toFixed(0)}% total (+${info.gainBonuses.regrowth.toFixed(0)}%/saison)</div>
      ${info.canDo ? '' : `<p class="prestige-modal-warn">Conditions non remplies pour l'instant.</p>`}
    `;
    els.prestigeConfirm.textContent = `Commencer la Saison ${info.nextSeason}`;
    els.prestigeConfirm.disabled = !info.canDo;
    els.prestigeModal.classList.add('active');
  });

  on('navBlocked', () => {
    showCareerChoiceIfNeeded(game);
  });

  const scrollMemory = {};
  let lastRenderedView = null;
  const unseenViews = new Set();
  function getScrollContainer() {
    return document.querySelector('.content-wrapper');
  }

  on('navigate', () => {
    const prevView = lastRenderedView;
    const sw = getScrollContainer();
    if (prevView && sw) scrollMemory[prevView] = sw.scrollTop;
    clearSchoolTimer();
    refreshView();
    refreshHeader(game.state);
    refreshObjectiveBanner();
    closeSidebar();
    updateNavActive();
    const curView = getView();
    unseenViews.delete(curView);
    if (sw && scrollMemory[curView] != null) {
      sw.scrollTop = scrollMemory[curView];
    } else if (sw) {
      sw.scrollTop = 0;
    }
    showFirstVisitHint(game.state, curView, () => game.scheduleSave?.());
  });
  on('stateChange', (state) => {
    showCareerChoiceIfNeeded(game);
    refreshHeader(state);
    refreshObjectiveBanner();
    const view = getView();
    const jobId = VIEWS[view]?.job;
    if (isFarmView(view)) {
      syncStaleFarmSlots(game);
    }
    if (isResourcePickerOpen() && jobId) {
      refreshJobViewLight(game, jobId);
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animTimer) tickHarvestUI();
      return;
    }
    const partial = shouldPartialRefreshOnStateChange(view, game);
    if (partial?.kind === 'job') {
      refreshJobViewLight(game, partial.jobId);
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animTimer) tickHarvestUI();
      return;
    }
    if (partial?.kind === 'farm') {
      refreshFarmViewLight(game, partial.buildingId);
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animTimer) tickHarvestUI();
      return;
    }
    if (partial?.kind === 'auction') {
      refreshAuctionHouseLight(game);
      refreshHeader(state);
      updateNavActive();
      return;
    }
    // Admin / Options : ne pas re-rendre toute la fiche (perte de focus / flash)
    if (view === 'admin' || view === 'options') {
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animTimer) tickHarvestUI();
      return;
    }
    refreshView();
    syncJobUnlockToasts();
    if ((game.isHarvesting() || game.isFarmActive()) && !animTimer) tickHarvestUI();
  });
  on('farmFeedChange', ({ buildingId, slotIndex }) => {
    patchFarmSlot(game, buildingId, slotIndex);
  });

  on('harvestSlotAssign', ({ jobId, unitIndex, slotIndex, resourceId }) => {
    patchHarvestSlot(game, jobId, unitIndex ?? slotIndex, resourceId);
  });
  on('adminPatchApplied', () => {
    showToast(els, '🎁 Ajustement admin reçu', 'upgrade');
    refreshHeader(game.state);
    refreshView();
  });
  on('uiToast', ({ message, type } = {}) => {
    if (message) showToast(els, message, type || 'harvest');
  });
  on('harvestStart', ({ jobId, unitIndex, slotIndex, resourceId }) => {
    patchHarvestSlot(game, jobId, unitIndex ?? slotIndex, resourceId);
    playHarvestSlotFx(jobId, unitIndex ?? slotIndex, resourceId, 'start');
    tickHarvestUI();
    audio.playSfx('click');
  });
  on('harvestComplete', ({ resourceId, jobId, unitIndex, slotIndex, yield: y, xp, levelResult, dailyBonus, harvestEvent, kirhaGain, discoveryId }) => {
    patchHarvestSlot(game, jobId, unitIndex ?? slotIndex, resourceId);
    playHarvestSlotFx(jobId, unitIndex ?? slotIndex, resourceId, 'complete', y, {
      harvestEvent,
      kirhaGain,
      discoveryId,
    });
    if (discoveryId && harvestEvent?.type === 'kirha') {
      import('./travelerJournalView.js').then(({ openHarvestDiscoveryModal }) => {
        import('../systems/harvestEvents.js').then(({ DISCOVERY_META }) => {
          openHarvestDiscoveryModal(DISCOVERY_META[discoveryId], kirhaGain);
        });
      }).catch(() => {});
    }
    if (levelResult) {
      const job = game.jobs[levelResult.jobId];
      const resource = game.resources[resourceId];
      showToast(els, `${resource?.name || ''} — ${job?.name || ''} Nv.${levelResult.level} !`, 'levelup');
      if (getView() !== 'admin' && getView() !== 'options') {
        els.levelFlash.classList.add('active');
        setTimeout(() => els.levelFlash.classList.remove('active'), 600);
      }
      audio.playSfx('levelup');
      syncJobUnlockToasts();
      buildNav();
    } else {
      audio.playSfx(harvestEvent ? 'ready' : 'harvest');
    }
    tickHarvestUI();
    refreshHeader(game.state);
  });
  on('travelingMerchantBuy', ({ resourceId, quantity, price }) => {
    const name = game.resources[resourceId]?.name || resourceId;
    showToast(els, `🧳 +${quantity} ${name} (−${formatNumber(price)} 💰)`, 'upgrade');
    refreshHeader(game.state);
  });
  on('travelingMerchantSell', ({ resourceId, quantity, price }) => {
    const name = game.resources[resourceId]?.name || resourceId;
    showToast(els, `🧳 Vendu ${quantity} ${name} (+${formatNumber(price)} 💰)`, 'sell');
    refreshHeader(game.state);
  });
  on('villageQuestComplete', (result) => {
    const name = result?.npc?.name || 'Villageois';
    const thanks = result?.thanks || 'Merci !';
    const r = result?.rewards || {};
    const bits = [];
    if (r.kirha) bits.push(`+${r.kirha} 💰`);
    if (r.nuggets) bits.push(`+${r.nuggets} pépite`);
    if (r.scrolls) bits.push(`+${r.scrolls} 📜`);
    showToast(els, `${name} : ${thanks}${bits.length ? ` · ${bits.join(' · ')}` : ''}`, 'upgrade');
    if (result?.clearBonus) {
      const b = result.clearBonus;
      const bBits = [];
      if (b.kirha) bBits.push(`+${b.kirha} 💰`);
      if (b.nuggets) bBits.push(`+${b.nuggets} pépite`);
      showToast(els, `Panneau 5/5 ! ${bBits.join(' · ')}`, 'prestige');
    }
    audio.playSfx('ready');
    refreshHeader(game.state);
  });
  on('villageSchoolComplete', (result) => {
    const name = result?.research?.name || 'Recherche';
    showToast(els, `🏫 ${name} terminée !`, 'upgrade');
    unseenViews.add('village_school');
    audio.playSfx('ready');
    refreshHeader(game.state);
    buildNav();
    updateNavActive();
  });
  on('villageSchoolStart', (result) => {
    const name = result?.research?.name || 'Recherche';
    showToast(els, `🏫 Étude commencée : ${name}`, 'upgrade');
  });
  on('regrowthStart', ({ jobId, unitIndex, slotIndex, resourceId }) => {
    patchHarvestSlot(game, jobId, unitIndex ?? slotIndex, resourceId);
    tickHarvestUI();
  });
  on('regrowthComplete', ({ resourceId, jobId, unitIndex, slotIndex }) => {
    patchHarvestSlot(game, jobId, unitIndex ?? slotIndex, resourceId);
    flashHarvestSlotReady(jobId, unitIndex ?? slotIndex, resourceId);
    updateNavActive();
    if (game.isHarvesting()) tickHarvestUI();
    audio.playSfx('ready');
  });
  on('nicknameError', ({ reason }) => showToast(els, reason, 'sell'));
  on('nicknameChange', (r) => {
    const msg = r.renamed
      ? `Pseudo : ${r.name} (−${formatNumber(r.cost)} 💰)`
      : `Bienvenue, ${r.name} !`;
    showToast(els, msg, 'upgrade');
    refreshHeader(game.state);
    if (getView() === 'character') refreshView();
  });
  on('charLevelUp', ({ level }) => {
    els.levelFlash.classList.add('active');
    setTimeout(() => els.levelFlash.classList.remove('active'), 600);
    showToast(els, `🧘 Personnage Nv.${level} !`, 'levelup');
    audio.playSfx('levelup');
  });
  on('combatStart', () => {
    openDungeonCombatModal(game);
  });
  on('combatTurn', (r) => {
    refreshDungeonCombatModal(game);
    if (r?.roomAdvanced) {
      const healNote = r.roomHeal ? ` · +${r.roomHeal} PV équipe` : '';
      showToast(els, `Salle ${(r.roomIndex ?? 0) + 1}/${r.roomCount || '?'} — ${r.foe?.emoji || '👾'} ${r.foe?.name || ''}${healNote}`, 'upgrade');
    }
  });
  on('navRefresh', () => {
    buildNav();
    updateNavActive();
  });
  on('authChange', () => {
    buildNav();
    updateNavActive();
  });
  on('authLoggedOut', async () => {
    buildNav();
    updateNavActive();
    refreshView();
    refreshHeader(game.state);
    const { showAuthWelcomeScreen } = await import('./authUi.js');
    showAuthWelcomeScreen();
  });
  on('careerChoiceApplied', () => {
    buildNav();
    refreshView();
    refreshHeader(game.state);
  });
  on('equipmentFused', (r) => {
    const msg = r.autoEquipped
      ? `Fusion ${RARITY_LABELS[r.toRarity] || r.toRarity} — rééquipé automatiquement !`
      : `Fusion : ${RARITY_LABELS[r.toRarity] || r.toRarity} !`;
    showToast(els, msg, 'upgrade');
  });
  on('combatVictory', (r) => {
    closeDungeonCombatModal();
    showDungeonResult(game, r);
    refreshCharacterCombatPanels(game);
    const equipCount = (r.equipmentDrops || []).length;
    const qMeta = game.getKeyQualityMeta?.() || {};
    const keyNote = r.keyDropped
      ? ` · 🗝️${r.keyQuality && qMeta[r.keyQuality] ? qMeta[r.keyQuality].emoji : ''} Clé !`
      : '';
    const chestNote = r.chest ? ` · coffre ${qMeta[r.chest.quality]?.emoji || ''}` : '';
    const equipNote = equipCount ? ` · ${equipCount} équip.` : '';
    const msg = r.isDungeon
      ? `Donjon terminé ! +${r.charXp} XP${equipNote}${chestNote}`
      : `Victoire ! +${r.charXp} XP${keyNote}${equipNote}`;
    showToast(els, msg, 'prestige');
    audio.playSfx('levelup');
  });
  on('combatFail', (r) => {
    closeDungeonCombatModal();
    showDungeonResult(game, r);
    showToast(els, 'Défaite au combat…', 'sell');
  });
  on('sell', ({ resourceId, amount, earnings, all }) => {
    if (all) showToast(els, `Vendu tout : ${formatNumber(earnings)} 💰`, 'sell');
    else showToast(els, `Vendu ${renderResourceIcon(game.resources[resourceId], 'toast-icon') || ''} → +${formatNumber(earnings)} Kirha`, 'sell');
    audio.playSfx('sell');
  });
  on('merchantBuy', ({ resourceId, quantity, price }) => {
    const res = game.resources[resourceId];
    showToast(
      els,
      `+${quantity} ${renderResourceIcon(res, 'toast-icon') || res?.name || ''} — ${formatNumber(price)} Kirha`,
      'upgrade',
      { label: 'Voir Banque', onClick: () => navigate('inventory') }
    );
    audio.playSfx('craft');
  });
  on('merchantSell', ({ resourceId, quantity, price }) => {
    const res = game.resources[resourceId];
    showToast(els, `−${quantity} ${renderResourceIcon(res, 'toast-icon') || res?.name || ''} → +${formatNumber(price)} Kirha`, 'sell');
    audio.playSfx('sell');
  });
  on('upgrade', ({ upgradeId, level }) => {
    showToast(els, `${game.balance.upgrades[upgradeId].name} → Nv.${level}`, 'upgrade');
    audio.playSfx('craft');
  });
  on('craft', ({ recipeId, recipe, levelResult }) => {
    let msg = `Crafté : ${recipe.emoji} ${recipe.name}`;
    if (levelResult) {
      const jobName = game.jobs[levelResult.jobId]?.name || 'Métier';
      msg += ` — ${jobName} Nv.${levelResult.level}`;
    }
    const equipable = game.equipment.equipable[recipeId];
    const isEquipped = equipable && isRecipeEquipped(game.state, recipeId);
    if (recipe.combatItem) {
      showToast(els, `${msg} — Va sur Perso pour l'équiper !`, 'craft');
    } else if (equipable && !isEquipped) {
      showToast(els, msg, 'craft', { label: 'Équiper', onClick: () => game.doEquip(recipeId) });
    } else {
      showToast(els, msg, 'craft');
    }
    audio.playSfx('craft');
  });
  on('dismantleCombat', ({ itemName, recovered }) => {
    const parts = Object.entries(recovered || {})
      .map(([id, n]) => `+${n} ${game.resources[id]?.name || id}`)
      .join(' · ');
    showToast(els, `Démantelé : ${itemName}${parts ? ` (${parts})` : ''}`, 'sell');
    audio.playSfx('craft');
  });
  on('toolBroken', ({ name }) => {
    showToast(els, `🔧 ${name || 'Outil'} usé — tape Refaire sur la ligne de récolte`, 'sell');
  });
  on('craftBlocked', ({ message }) => {
    showToast(els, message || 'Fabrication impossible', 'sell');
  });
  on('harvestBlocked', ({ message }) => {
    showToast(els, message || 'Outil requis pour récolter', 'sell');
  });
  on('farmBlocked', ({ message }) => {
    showToast(els, message || 'Impossible de produire', 'sell');
  });
  on('mealUsed', ({ mealName, healed, hp, maxHp, buff, label, companions, restoredMp, mp, maxMp }) => {
    if (buff) {
      showToast(els, `⚗️ ${mealName} : ${label || 'buff actif'}`, 'upgrade');
      return;
    }
    if (restoredMp != null) {
      showToast(els, `🐟 ${mealName} : +${restoredMp} PM (${mp}/${maxMp})`, 'upgrade');
      return;
    }
    if (companions) {
      showToast(els, `🐟 ${mealName} : +${healed} PV équipiers`, 'upgrade');
      return;
    }
    showToast(els, `🍙 ${mealName} : +${healed} PV (${hp}/${maxHp})`, 'upgrade');
  });
  on('journalUnlock', ({ entry }) => {
    if (!entry) return;
    showToast(els, `📔 Nouvelle page : ${entry.emoji || ''} ${entry.title || 'Carnet'}`, 'upgrade');
    unseenViews.add('traveler_journal');
    updateNavActive();
    import('./travelerJournalView.js').then((m) => m.focusLatestJournalPage?.()).catch(() => {});
  });
  on('herbariumDiscover', ({ resource }) => {
    if (!resource) return;
    showToast(els, `🌿 Herbier : ${resource.emoji || ''} ${resource.name || 'nouvelle ressource'}`, 'upgrade');
  });
  document.getElementById('journal-page-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'journal-page-modal') {
      import('./travelerJournalView.js').then(({ closeJournalPageModal }) => closeJournalPageModal());
    }
  });
  on('stateChange', () => {
    game.syncTravelerJournal?.();
  });
  on('toolRepaired', ({ itemName, toolName, gained, remaining, max }) => {
    showToast(els, `🔧 ${itemName} : ${toolName} +${gained} (${remaining}/${max})`, 'upgrade');
  });
  on('farmComplete', (outcome) => {
    const { buildingId, products, animalExpired, animalName, levelResult } = outcome || {};
    if (products && Object.keys(products).length) {
      audio.playSfx('harvest');
    }
    if (levelResult?.leveledUp) {
      const label = game.farmData?.buildings?.[buildingId]?.name || buildingId;
      showToast(els, `${label} Nv.${levelResult.level} !`, 'levelup');
    }
    if (animalExpired) {
      showToast(
        els,
        `${animalName || 'Animal'} fatigué — rachète-en un pour continuer`,
        'sell'
      );
    }
    if (buildingId != null) {
      patchFarmBuildingSlots(game, buildingId);
    }
    syncStaleFarmSlots(game);
    refreshCharToolsIfVisible(game);
    if (isFarmView(getView())) {
      refreshView();
    }
    if (game.isFarmActive() && !animTimer) tickHarvestUI();
  });
  on('farmSlotUnlock', ({ buildingId, slots }) => {
    showToast(els, `Nouvel emplacement ferme ! (${slots} slots)`, 'upgrade');
    if (isFarmView(getView())) refreshView();
  });
  on('farmStart', ({ buildingId, productId, unitIndex }) => {
    if (buildingId != null && productId != null && unitIndex != null) {
      patchFarmUnitCard(game, buildingId, productId, unitIndex);
    }
    // Rafraîchir stock ration + décompte outil après consommation
    if (isFarmView(getView())) refreshView();
    if (!animTimer) tickHarvestUI();
  });
  on('equip', ({ recipeId }) => {
    const r = game.recipes[recipeId];
    showToast(els, `Équipé : ${r.emoji} ${r.name}`, 'upgrade');
  });
  on('slotUnlock', ({ slots }) => showToast(els, `Nouvel emplacement ! (${slots} slots)`, 'upgrade'));
  on('zoneUnlock', ({ zone, auto }) => {
    const prefix = auto ? 'Nouvelle zone débloquée :' : 'Zone :';
    showToast(els, `${prefix} ${zone.emoji} ${zone.name}`, 'zone');
  });
  on('questComplete', ({ quest }) => {
    if (game.balance?.achievementsEnabled !== true && game.balance?.questsEnabled !== true) return;
    showToast(els, `🏆 Succès : ${quest.title}`, 'upgrade');
  });

  on('achievementComplete', ({ achievement }) => {
    if (game.balance?.achievementsEnabled !== true && game.balance?.questsEnabled !== true) return;
    if (achievement?.id) focusAchievementInChain(game.achievements, achievement.id);
    const rewardBits = [];
    if (achievement?.rewardKirha) rewardBits.push(`+${achievement.rewardKirha} 💰`);
    if (achievement?.rewardScrolls) rewardBits.push(`+${achievement.rewardScrolls} parchemin${achievement.rewardScrolls > 1 ? 's' : ''}`);
    if (achievement?.rewardNuggets) rewardBits.push(`+${achievement.rewardNuggets} pépite${achievement.rewardNuggets > 1 ? 's' : ''}`);
    const rewardTxt = rewardBits.length ? ` · ${rewardBits.join(' · ')}` : '';
    showToast(els, `🏆 Succès : ${achievement.title}${rewardTxt}`, 'upgrade');
    updateNavActive();
  });
  on('offlineProgress', (r) => showOfflineModal(game, els, r));
  on('prestige', ({ season }) => {
    const { kirhaPct, xpPct, jobXpPct, regrowthPct } = getSeasonBonusPercents(game.state);
    const bits = [];
    if (kirhaPct > 0) bits.push(`+${kirhaPct}% 💰`);
    if (xpPct > 0) bits.push(`+${xpPct}% perso`);
    if (jobXpPct > 0) bits.push(`+${jobXpPct}% métiers`);
    if (regrowthPct > 0) bits.push(`+${regrowthPct}% repousse`);
    bits.push('boost ×2 à activer (Saison)');
    const bonusTxt = bits.length ? ` · ${bits.join(' · ')}` : '';
    showToast(els, `🌸 Saison ${season} !${bonusTxt}`, 'prestige');
  });
  on('seasonBoostActivated', () => {
    showToast(els, '⚡ Boost ×2 activé pour 1 h', 'upgrade');
    refreshHeader(game.state);
  });
  on('toolUpgrade', ({ recipeId }) => {
    const name = game.recipes[recipeId]?.name || 'Outil';
    showToast(els, `🔧 ${name} amélioré (+${game.balance.toolSeasonUpgrade?.bonusUses ?? 10} utilisations)`, 'upgrade');
  });
  on('toolUpgradeBlocked', ({ message }) => showToast(els, message || 'Amélioration impossible', 'sell'));
  on('settingsChange', (s) => {
    audio.updateSettings(s);
    document.documentElement.dataset.theme = s.darkMode ? 'dark' : '';
  });

  refreshHeader(game.state);
  refreshView();
  showWhatsNewIfNeeded();
  els.whatsNewConfirm?.addEventListener('click', () => {
    markChangelogSeen(game.balance);
    els.whatsNewModal?.classList.remove('active');
    els.whatsNewModal?.setAttribute('aria-hidden', 'true');
  });
  function closeTravelingMerchantModal() {
    els.travelingMerchantModal?.classList.remove('active');
    els.travelingMerchantModal?.setAttribute('aria-hidden', 'true');
  }

  function maybeShowTravelingMerchantPopup() {
    const status = game.getTravelingMerchantStatus?.();
    if (!status?.active || status.popupSeen) return;
    if (els.whatsNewModal?.classList.contains('active')) return;
    els.travelingMerchantModal?.classList.add('active');
    els.travelingMerchantModal?.setAttribute('aria-hidden', 'false');
  }

  on('stateChange', () => {
    maybeShowTravelingMerchantPopup();
  });

  els.travelingMerchantDismiss?.addEventListener('click', () => {
    game.markTravelingMerchantPopupSeen?.();
    closeTravelingMerchantModal();
    updateNavActive();
  });
  els.travelingMerchantGoto?.addEventListener('click', () => {
    game.markTravelingMerchantPopupSeen?.();
    closeTravelingMerchantModal();
    setAuctionMainMode('traveler');
    navigate('auction_house');
    updateNavActive();
  });

  cleanupPullRefreshArtifacts();
  syncSakuraWindVisual(game);
  updateNavActive();
  refreshObjectiveBanner();
  maybeShowTravelingMerchantPopup();
  tickHarvestUI();
}

function showToast(els, message, type = 'harvest', action = null) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const body = document.createElement('span');
  body.className = 'toast-body';
  if (typeof message === 'string' && message.includes('<')) {
    body.innerHTML = message;
  } else {
    body.textContent = message;
  }
  toast.appendChild(body);

  const dismiss = document.createElement('button');
  dismiss.className = 'toast-dismiss';
  dismiss.innerHTML = '✕';
  dismiss.setAttribute('aria-label', 'Fermer');
  dismiss.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(dismiss);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
      toast.remove();
    });
    body.appendChild(document.createElement('br'));
    body.appendChild(btn);
  }

  els.toasts.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  const important = type === 'levelup' || type === 'prestige' || type === 'upgrade';
  const duration = action ? 6000 : important ? 4000 : 2500;
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
