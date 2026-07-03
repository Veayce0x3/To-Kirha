import { on } from '../core/events.js';
import { forceAppRefresh } from '../core/reload.js';
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
import {
  renderView,
  renderJobSwitcherDock,
  updateJobSwitcherDockStatus,
  showOfflineModal,
  showDungeonResult,
  initSakuraPetals,
  formatNumber,
  updateHarvestSlotProgresses,
  updateFarmSlotProgresses,
  patchFarmSlot,
  patchFarmBuildingSlots,
  syncStaleFarmSlots,
  refreshCharToolsIfVisible,
  patchHarvestSlot,
  closeAllResourcePickers,
  isResourcePickerOpen,
  refreshJobViewLight,
  refreshFarmViewLight,
  shouldPartialRefreshOnStateChange,
  openDungeonCombatModal,
  refreshDungeonCombatModal,
  closeDungeonCombatModal,
  refreshAuctionHouseLight,
  refreshCharacterCombatPanels,
} from './views.js';

export function initUI(game, audio) {
  initSakuraPetals();
  initCareerChoiceModal(game);
  showCareerChoiceIfNeeded(game);

  setNavigateGuard((viewId) => {
    if (!game.needsCareerChoice()) return true;
    return viewId === 'character' || viewId === 'options';
  });

  const els = {
    kirha: document.getElementById('kirha-amount'),
    scrollAmount: document.getElementById('scroll-amount'),
    goldNuggetAmount: document.getElementById('gold-nugget-amount'),
    quickScroll: document.getElementById('quick-scroll'),
    seasonBadge: document.getElementById('season-badge'),
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
    startupRefreshModal: document.getElementById('startup-refresh-modal'),
    startupRefreshConfirm: document.getElementById('startup-refresh-confirm'),
    startupRefreshSkip: document.getElementById('startup-refresh-skip'),
  };

  let lastKirha = game.state.kirha;
  let animFrame = null;

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
      levelHtml = `<span class="nav-level">${game.getJobLevel('breeder')}</span>`;
    } else if (showLevel && viewId === 'character') {
      levelHtml = `<span class="nav-level">${game.getCharacterProgress().level}</span>`;
    }

    const navIcon = getNavIcon(viewId) || (view.job ? getJobIcon(view.job) : null);
    const iconPart = navIcon
      ? iconHtml(navIcon, 'nav-icon', view.label)
      : (view.emoji ? `<span class="nav-emoji">${view.emoji}</span>` : '');

    const statusDot = (view.job || view.building) ? '<span class="nav-status-dot" aria-hidden="true"></span>' : '';

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

  function buildNav() {
    els.sidebarNav.innerHTML = '';
    els.sidebarFooter.innerHTML = '';

    for (const cat of getNavCategories(game.state)) {
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

      for (const viewId of cat.items) {
        const btn = createNavBtn(viewId);
        if (btn) items.appendChild(btn);
      }

      if (cat.id === 'recolte' || cat.id === 'ferme') {
        const hint = document.createElement('p');
        hint.className = 'nav-cat-hint';
        hint.textContent = cat.id === 'recolte'
          ? 'Chiffre = niveau du métier · Point coloré = état récolte (prêt, en cours, repousse).'
          : 'Chiffre = niveau Éleveur · Point coloré = production en cours dans le bâtiment.';
        items.appendChild(hint);
      }

      section.appendChild(items);
      els.sidebarNav.appendChild(section);
    }

    for (const viewId of SIDEBAR_FOOTER) {
      const btn = createNavBtn(viewId, false);
      if (btn) els.sidebarFooter.appendChild(btn);
    }
  }

  const HARVEST_NAV_CLASSES = [
    'nav-active-harvest',
    'nav-harvest-ready',
    'nav-harvest-harvesting',
    'nav-harvest-regrowing',
    'nav-harvest-empty',
  ];

  function updateNavActive() {
    const view = getView();

    document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
      const vid = btn.dataset.view;
      btn.classList.toggle('active', vid === view);
      btn.classList.remove(...HARVEST_NAV_CLASSES);
      delete btn.dataset.harvestStatus;

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
    });
    updateJobSwitcherDockStatus(game);
  }

  function refreshView() {
    closeAllResourcePickers();
    const view = getView();
    renderView(game, els.viewContainer, view);
    renderJobSwitcherDock(game, els.jobSwitcherDock, view);
    updateNavActive();
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
    els.seasonBadge.textContent = `Saison ${state.season || 1}`;
    els.viewTitle.textContent = getViewTitle();
    const zone = game.getCurrentZone();
    els.zoneSubtitle.textContent = zone ? `${zone.emoji} ${zone.name}` : '';
  }

  function tickActiveUI() {
    const harvesting = game.isHarvesting();
    const farming = game.isFarmActive();
    if (harvesting) updateHarvestSlotProgresses(game);
    if (farming) updateFarmSlotProgresses(game);
    if (harvesting || farming) {
      updateNavActive();
      animFrame = requestAnimationFrame(tickActiveUI);
    } else {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  function tickHarvestUI() {
    tickActiveUI();
  }

  function showStartupRefreshPrompt() {
    const justRefreshed = new URL(window.location.href).searchParams.has('tokirha_refresh');
    if (!els.startupRefreshModal || justRefreshed || game.needsCareerChoice()) return;
    els.startupRefreshModal.classList.add('active');
    els.startupRefreshConfirm?.addEventListener('click', () => {
      forceAppRefresh(game);
    }, { once: true });
    els.startupRefreshSkip?.addEventListener('click', () => {
      els.startupRefreshModal.classList.remove('active');
    }, { once: true });
  }

  buildNav();

  els.burgerBtn?.addEventListener('click', openSidebar);
  els.sidebarOverlay?.addEventListener('click', closeSidebar);
  els.quickOptions?.addEventListener('click', () => navigate('options'));
  els.quickScroll?.addEventListener('click', () => navigate('auction_house'));

  on('sidebarClose', closeSidebar);

  els.offlineClose.addEventListener('click', () => els.offlineModal.classList.remove('active'));
  els.prestigeCancel.addEventListener('click', () => els.prestigeModal.classList.remove('active'));
  els.prestigeConfirm.addEventListener('click', () => {
    if (game.doPrestige()) {
      els.prestigeModal.classList.remove('active');
      audio.playSfx('prestige');
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
      <div class="prestige-gain-row">💰 Kirha : +${info.nextBonuses.kirha.toFixed(0)}% total</div>
      <div class="prestige-gain-row">📜 XP : +${info.nextBonuses.xp.toFixed(0)}% total</div>
      ${info.canDo ? '' : `<p class="prestige-modal-warn">Conditions non remplies pour l'instant.</p>`}
    `;
    els.prestigeConfirm.textContent = `Commencer la Saison ${info.nextSeason}`;
    els.prestigeConfirm.disabled = !info.canDo;
    els.prestigeModal.classList.add('active');
  });

  on('navBlocked', () => {
    showCareerChoiceIfNeeded(game);
  });

  on('navigate', () => {
    refreshView();
    refreshHeader(game.state);
    closeSidebar();
    updateNavActive();
  });
  on('stateChange', (state) => {
    showCareerChoiceIfNeeded(game);
    refreshHeader(state);
    const view = getView();
    const jobId = VIEWS[view]?.job;
    if (isFarmView(view)) {
      syncStaleFarmSlots(game);
    }
    if (isResourcePickerOpen() && jobId) {
      refreshJobViewLight(game, jobId);
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animFrame) tickHarvestUI();
      return;
    }
    const partial = shouldPartialRefreshOnStateChange(view, game);
    if (partial?.kind === 'job') {
      refreshJobViewLight(game, partial.jobId);
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animFrame) tickHarvestUI();
      return;
    }
    if (partial?.kind === 'farm') {
      refreshFarmViewLight(game, partial.buildingId);
      updateNavActive();
      if ((game.isHarvesting() || game.isFarmActive()) && !animFrame) tickHarvestUI();
      return;
    }
    if (partial?.kind === 'auction') {
      refreshAuctionHouseLight(game);
      refreshHeader(state);
      updateNavActive();
      return;
    }
    refreshView();
    if ((game.isHarvesting() || game.isFarmActive()) && !animFrame) tickHarvestUI();
  });
  on('farmFeedChange', ({ buildingId, slotIndex }) => {
    patchFarmSlot(game, buildingId, slotIndex);
  });

  on('harvestSlotAssign', ({ jobId, slotIndex }) => {
    patchHarvestSlot(game, jobId, slotIndex);
  });
  on('harvestStart', ({ jobId, slotIndex }) => {
    patchHarvestSlot(game, jobId, slotIndex);
    tickHarvestUI();
    audio.playSfx('click');
  });
  on('harvestComplete', ({ resourceId, jobId, slotIndex, yield: y, xp, levelResult, dailyBonus }) => {
    patchHarvestSlot(game, jobId, slotIndex);
    const resource = game.resources[resourceId];
    if (levelResult) {
      const job = game.jobs[levelResult.jobId];
      showToast(els, `+${y} ${resource?.name || ''} — ${job?.name || ''} Nv.${levelResult.level} !`, 'levelup');
      els.levelFlash.classList.add('active');
      setTimeout(() => els.levelFlash.classList.remove('active'), 600);
      audio.playSfx('levelup');
    } else {
      const bonusNote = dailyBonus ? ' · Bonus du jour ×2 !' : '';
      showToast(els, `+${y} ${resource?.name || ''}${bonusNote}`, 'harvest');
      audio.playSfx('harvest');
    }
    tickHarvestUI();
  });
  on('regrowthStart', ({ jobId, slotIndex }) => {
    patchHarvestSlot(game, jobId, slotIndex);
    tickHarvestUI();
  });
  on('regrowthComplete', ({ resourceId, jobId, slotIndex }) => {
    patchHarvestSlot(game, jobId, slotIndex);
    flashHarvestSlotReady(jobId, slotIndex);
    updateNavActive();
    if (game.isHarvesting()) tickHarvestUI();
    audio.playSfx('ready');
    const viewJob = VIEWS[getView()]?.job;
    if (viewJob !== jobId) {
      const resource = game.resources[resourceId];
      const job = game.jobs[jobId];
      const targetView = JOB_VIEW_MAP[jobId];
      const label = resource?.emoji
        ? `${resource.emoji} Prêt : ${resource.name || ''}`
        : `Prêt à récolter : ${resource?.name || ''}`;
      showToast(
        els,
        label,
        'ready',
        targetView
          ? { label: `→ ${job?.name || 'Récolte'}`, onClick: () => navigate(targetView) }
          : null
      );
    }
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
  on('navRefresh', () => buildNav());
  on('careerChoiceApplied', () => {
    buildNav();
    refreshView();
    refreshHeader(game.state);
  });
  on('equipmentFused', (r) => { showToast(els, `Fusion : ${RARITY_LABELS[r.toRarity] || r.toRarity} !`, 'upgrade'); });
  on('combatVictory', (r) => {
    closeDungeonCombatModal();
    showDungeonResult(game, r);
    refreshCharacterCombatPanels(game);
    const equipCount = (r.equipmentDrops || []).length;
    const keyNote = r.keyDropped ? ' · 🗝️ Clé !' : '';
    const equipNote = equipCount ? ` · ${equipCount} équip.` : '';
    const msg = r.isDungeon ? `Donjon terminé ! +${r.charXp} XP${equipNote}` : `Victoire ! +${r.charXp} XP${keyNote}${equipNote}`;
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
    showToast(els, `🔧 ${name || 'Outil'} usé — refabrique-le à l'atelier`, 'sell');
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
  on('mealUsed', ({ mealName, healed, hp, maxHp }) => {
    showToast(els, `🍙 ${mealName} : +${healed} PV (${hp}/${maxHp})`, 'upgrade');
  });
  on('farmComplete', ({ buildingId }) => {
    if (buildingId != null) {
      patchFarmBuildingSlots(game, buildingId);
    }
    syncStaleFarmSlots(game);
    refreshCharToolsIfVisible(game);
    const view = getView();
    if (isFarmView(view)) {
      const building = VIEWS[view]?.building;
      if (game.isFarmActive() && building) {
        refreshFarmViewLight(game, building);
      } else {
        refreshView();
      }
    }
    if (game.isFarmActive() && !animFrame) tickHarvestUI();
  });
  on('farmSlotUnlock', ({ buildingId, slots }) => {
    showToast(els, `Nouvel emplacement ferme ! (${slots} slots)`, 'upgrade');
    if (isFarmView(getView())) refreshView();
  });
  on('farmStart', () => {
    if (!animFrame) tickHarvestUI();
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
    showToast(els, `📜 Quête terminée : ${quest.title}`, 'upgrade');
  });
  on('offlineProgress', (r) => showOfflineModal(game, els, r));
  on('prestige', ({ season }) => showToast(els, `🌸 Saison ${season} !`, 'prestige'));
  on('settingsChange', (s) => {
    audio.updateSettings(s);
    document.documentElement.dataset.theme = s.darkMode ? 'dark' : '';
  });

  refreshHeader(game.state);
  refreshView();
  showStartupRefreshPrompt();
  if (game.isHarvesting() || game.isFarmActive()) tickHarvestUI();
}

function showToast(els, message, type = 'harvest', action = null) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  if (typeof message === 'string' && message.includes('<')) {
    toast.innerHTML = message;
  } else {
    toast.textContent = message;
  }

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
      toast.remove();
    });
    toast.appendChild(document.createElement('br'));
    toast.appendChild(btn);
  }

  els.toasts.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, action ? 4000 : 2000);
}
