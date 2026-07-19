import { resolveItem, getSkillTargetMode, getLivingEnemies, getActiveEnemy, canEquipCombatItem, findCombatItemOwner, getInstanceEffectiveStats, getSkillUsesLeft, getSkillMaxUses } from '../systems/combat.js';
import { getCraftSellBonus, getRecipeRequiredLevel } from '../systems/crafting.js';
import { mountCraftWorkshop } from './craftView.js';
import { isResourceUnlockedByJob } from '../systems/zones.js';
import { getEquippedLabel, getOwnedGatheringEquipment, isRecipeEquipped } from '../systems/equipment.js';
import { formatOfflineDuration } from '../systems/offline.js';
import { navigate, getView, VIEWS, JOB_VIEW_MAP, getCraftJobFromView, CRAFT_NAV, getHarvestViewForJob, getFarmViewForBuilding, isFarmView, HARVEST_JOB_VIEWS, FARM_BUILDING_VIEWS, isWorkshopView } from './router.js';
import { getHarvestTime, getRegrowthTime, getHarvestYield, getHarvestXp } from '../systems/harvest.js';
import { getResourceVisual, getSlotVisualDisplay, renderResourceIcon, getResourceIcon } from '../systems/resourceVisual.js';
import { getJobIcon, getNavIcon, getFarmBuildingIcon, getFarmProductIcon, UI, iconHtml } from '../core/assets.js';
import { forceAppRefresh } from '../core/reload.js';
import { getAppBuildId, getLastSeenBuildId } from '../core/startupRefresh.js';
import {
  getQuestStatusText,
  getAchievementStatusText,
  isQuestCompleted,
  isAchievementCompleted,
  isQuestReady,
  isAchievementReady,
  getAchievementsByCategory,
  ACHIEVEMENT_CATEGORY_LABELS,
  getAchievementBonuses,
} from '../systems/achievements.js';
import { getCombatItemPreview, getItemLevel, getWeaponRolePreview, renderDurabilityBar, renderEquippedToolRow, renderDQStatsBlock } from '../systems/equipmentDisplay.js';
import { isDurabilityTool, isToolBroken } from '../systems/toolDurability.js';
import { emit } from '../core/events.js';
import { FARM_BUILDING_IDS, canAffordFeed, getBuildingDef, getFeedCost, getPrimaryFeedId, listFeedOptions, FARM_BUILDING_LABELS } from '../systems/farm.js';
import { listOwnedMeals, countOwnedMeals, getMealEffect } from '../systems/consumables.js';
import { RARITY_LABELS, RARITY_EMOJI, getInstanceRarity, getNextRarity } from '../systems/equipmentRarity.js';
import { getFusionInputCount, getFusionKirhaCost, canFuseGroup } from '../systems/equipmentFusion.js';
import { getDungeonKeyId } from '../systems/dungeonKeys.js';
import { getVisibleHarvestViews, getVisibleFarmViews, isGatheringJobUnlocked, getGatheringJobUnlockProgress, getFeatureUnlockProgress, getJobSwitcherItems } from '../systems/careerChoice.js';
import { getTestHdvBanner, isTestHdvEnabled } from '../systems/testHdv.js';
import { showCareerChoiceIfNeeded } from './careerChoiceUi.js';
import { reconcileAuthAfterLocalReset } from '../core/resetAuth.js';
import { renderGuestBanner, renderAccountPanel, showAccountRequiredModal } from './authUi.js';
import { isRegisteredAccount, hasFreeRenameAvailable, applyServerDisplayNameToGame, refreshProfile } from '../core/auth.js';
import { changeDisplayNameFree } from '../systems/accountProfile.js';
import { renderLeaderboard } from './leaderboardView.js';
import { renderJobProduction, renderFarmProduction, updateProductionLineProgresses, updateFarmLineProgresses } from './productionLineView.js';
import { renderAdmin } from './adminView.js';
import { canUseOnlineFeatures, getOnlineBlockReason } from '../core/auth.js';
import { isMaintenanceMode } from '../systems/gameConfig.js';

let workshopTab = 'toolmaker';
let charTab = 'bag';
const CHAR_TABS = new Set(['bag', 'gear', 'tools', 'team']);

function normalizeCharTab(tab) {
  return CHAR_TABS.has(tab) ? tab : 'bag';
}
let auctionCategory = '';
let auctionGroup = 'services';
let hdvMainMode = 'npc';
let auctionRootEl = null;
let combatUi = { step: 'action', menu: 'main', pendingSkill: null, targetMode: null };

export function resetCombatUi() {
  combatUi = { step: 'action', menu: 'main', pendingSkill: null, targetMode: null };
}

function resetCombatUiTurn() {
  combatUi = { step: 'action', menu: 'main', pendingSkill: null, targetMode: null };
}

const SET_LABELS = { sakura: 'Sakura', petal: 'Pétale', jade: 'Jade' };

function renderLockedUnlockPanel(game, el, entry) {
  const pct = Math.floor((entry.progress || 0) * 100);
  const icon = entry.featureId
    ? (getNavIcon(entry.viewId) || null)
    : getJobIcon(entry.jobId);
  const iconPart = icon
    ? iconHtml(icon, 'feature-locked-icon-img', entry.label)
    : `<span class="feature-locked-emoji">${entry.emoji || '🔒'}</span>`;

  let gatesHtml = '';
  if (entry.gates?.length) {
    gatesHtml = entry.gates.map((gate) => {
      const gatePct = Math.floor((gate.progress || 0) * 100);
      const label = gate.type === 'building'
        ? gate.buildingName
        : gate.jobName;
      const meta = gate.ready
        ? '✓ Atteint'
        : gate.type === 'building' && gate.requiredLevel == null
          ? 'Non débloqué'
          : gate.type === 'totalHarvests'
            ? `${gate.currentLevel} / ${gate.requiredLevel} récoltes`
            : gate.type === 'characterLevel'
              ? `Perso Nv.${gate.currentLevel} / ${gate.requiredLevel}`
              : `Nv.${gate.currentLevel} / ${gate.requiredLevel}`;
      return `
        <div class="feature-locked-gate${gate.ready ? ' feature-locked-gate-ready' : ''}">
          <div class="feature-locked-gate-head">
            <strong>${label}</strong>
            <span>${meta}</span>
          </div>
          <div class="xp-bar-container"><div class="xp-bar" style="width:${gatePct}%"></div></div>
        </div>
      `;
    }).join('');
  } else {
    const gateName = game.jobs[entry.gateJob]?.name || entry.gateJob;
    gatesHtml = `
      <div class="feature-locked-gate${entry.ready ? ' feature-locked-gate-ready' : ''}">
        <div class="feature-locked-gate-head">
          <strong>${gateName}</strong>
          <span>${entry.ready ? '✓ Atteint' : `Nv.${entry.currentLevel} / ${entry.requiredLevel}`}</span>
        </div>
        <div class="xp-bar-container"><div class="xp-bar" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  const farmerView = getHarvestViewForJob('farmer');
  el.innerHTML = `
    <div class="feature-locked-panel">
      <div class="feature-locked-icon">${iconPart}</div>
      <h2>${entry.label}</h2>
      <p class="feature-locked-badge">🔒 Se débloque plus tard dans le jeu</p>
      ${entry.hint ? `<p class="view-desc feature-locked-hint">${entry.hint}</p>` : ''}
      <div class="feature-locked-gates">${gatesHtml}</div>
      <p class="view-desc feature-locked-progress">Progression globale : ${pct}%</p>
      ${farmerView ? `<button type="button" class="btn btn-craft btn-small" id="locked-go-farmer">Continuer en Paysan</button>` : ''}
    </div>
  `;

  el.querySelector('#locked-go-farmer')?.addEventListener('click', () => navigate(farmerView));
}

function navigateObjective(game, objective) {
  if (!objective) return;
  if (objective.hintView) {
    navigate(objective.hintView === 'workshop' ? 'workshop' : objective.hintView);
  } else if (objective.hintJob) {
    navigate(JOB_VIEW_MAP[objective.hintJob] || 'world');
  }
}

function renderObjectiveBanner(game, container, { ready = false } = {}) {
  if (!container) return;
  const objective = game.getCurrentObjective();
  if (!objective) {
    container.innerHTML = '<p class="empty-text">Aucun objectif pour le moment.</p>';
    return;
  }

  container.innerHTML = `
    <div class="mission-current-label">Objectif actuel</div>
    <h3>${objective.title}</h3>
    <p class="view-desc">${objective.description}</p>
    ${ready ? '<span class="mission-ready-badge">Prête !</span>' : ''}
  `;

  const prestigeInfo = game.getPrestigeInfo();
  const showPrestigeBtn = objective.openPrestige
    || objective.source === 'prestige'
    || (objective.source === 'season_cap' && objective.hintView === 'options');

  if (showPrestigeBtn) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = `btn btn-small ${prestigeInfo.canDo ? 'btn-prestige' : 'btn-muted'} mission-go`;
    go.textContent = prestigeInfo.canDo ? 'Nouvelle saison' : 'Saison suivante';
    go.addEventListener('click', () => emitPrestigeModal());
    container.appendChild(go);
  } else if (objective.hintView || objective.hintJob) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn btn-craft btn-small mission-go';
    go.textContent = 'Y aller';
    go.addEventListener('click', () => navigateObjective(game, objective));
    container.appendChild(go);
  }
}

function renderPrestigeTeaser(game, container) {
  if (!container || !game.shouldShowPrestigeTeaser()) {
    if (container) container.innerHTML = '';
    return;
  }

  const proximity = game.getSeasonCapProximity();
  const progress = game.getPrestigeProgress();
  const info = game.getPrestigeInfo();
  const p = game.state.prestige || {};
  const capHint = proximity.showTeaser && !proximity.atCap
    ? `<p class="season-cap-hint">Tu approches du plafond Saison ${proximity.season} (perso ${proximity.charLevel}/${proximity.charCap} · métiers ${proximity.maxJobLevel}/${proximity.jobsCap}).</p>`
    : proximity.atCap
      ? `<p class="season-cap-hint">Plafond Saison ${proximity.season} atteint — passe à la Saison ${proximity.nextSeason} pour continuer.</p>`
      : '';

  container.innerHTML = `
    <div class="prestige-teaser-head">
      <span class="prestige-teaser-label">🌸 Saison suivante</span>
      <strong>Saison ${info.nextSeason}</strong>
    </div>
    <p class="view-desc">Prérequis : ${progress.completed}/${progress.total} · Bonus actuels +${Math.round((p.kirhaBonus || 0) * 100)}% 💰 · +${Math.round((p.xpBonus || 0) * 100)}% XP</p>
    <div class="xp-bar-container prestige-teaser-bar"><div class="xp-bar" style="width:${progress.percent}%"></div></div>
    ${capHint}
    ${info.canDo ? '<p class="prestige-ready">Tout est prêt pour une nouvelle saison !</p>' : ''}
    <button type="button" class="btn btn-small ${info.canDo ? 'btn-prestige' : 'btn-muted'}" id="char-prestige-btn">Voir détails</button>
  `;

  container.querySelector('#char-prestige-btn')?.addEventListener('click', () => emitPrestigeModal());
}

function splitSkillsByDqMenu(skills) {
  return { attacks: skills, spells: [] };
}

function pickCombatSkill(game, body, skillId, skills, livingEnemies) {
  const skill = skills.find((s) => s.id === skillId);
  const mode = getSkillTargetMode(skill);
  if (mode === 'self') {
    executeCombatTurn(game, body, () => game.useCombatSkill(skillId, 'self'));
    return;
  }
  if (mode === 'enemy' && livingEnemies.length === 1) {
    executeCombatTurn(game, body, () => game.useCombatSkill(skillId, livingEnemies[0].id));
    return;
  }
  combatUi = { ...combatUi, step: 'target', pendingSkill: skillId, targetMode: mode };
  renderDungeonCombatBody(game);
}

function renderQuestJournal(game, container, { compact = false } = {}) {
  const active = game.getActiveQuests();
  if (active.length === 0) {
    container.innerHTML = '<p class="empty-text">Toutes les quêtes de la zone sont terminées. 🌸</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = `quest-list${compact ? ' quest-list-compact' : ''}`;

  for (const quest of active) {
    const ready = !isQuestCompleted(game.state, quest.id)
      && game.getNextQuest()?.id === quest.id;
    const row = document.createElement('div');
    row.className = `quest-row${ready ? ' quest-ready' : ''}${isQuestCompleted(game.state, quest.id) ? ' quest-done' : ''}`;
    row.innerHTML = `
      <div class="quest-row-head">
        <strong>${quest.title}</strong>
        <span class="quest-status">${getQuestStatusText(quest, game.state, game.recipes)}</span>
      </div>
      <p class="quest-desc">${quest.description}</p>
    `;
    if (quest.hintView && ready) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn btn-small btn-muted quest-go';
      go.textContent = 'Y aller';
      go.addEventListener('click', () => navigate(quest.hintView === 'workshop' ? 'workshop' : quest.hintView));
      row.appendChild(go);
    } else if (quest.hintJob && ready) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn btn-small btn-muted quest-go';
      go.textContent = 'Récolter';
      go.addEventListener('click', () => navigate(JOB_VIEW_MAP[quest.hintJob] || 'world'));
      row.appendChild(go);
    }
    list.appendChild(row);
  }
  container.appendChild(list);
}

export function renderView(game, container, viewId) {
  container.innerHTML = '';
  if (viewId === 'workshop_cook' || viewId === 'cuisine') {
    renderCuisine(game, container);
    return;
  }
  if (viewId === 'workshop' || viewId.startsWith('workshop_')) {
    if (viewId.startsWith('workshop_')) workshopTab = getCraftJobFromView(viewId) || workshopTab;
    renderWorkshopHub(game, container);
    return;
  }

  const craftJob = getCraftJobFromView(viewId);
  if (craftJob) {
    workshopTab = craftJob;
    renderWorkshopHub(game, container);
    return;
  }

  const renderers = {
    character: renderCharacter,
    achievements: renderAchievements,
    missions: renderAchievements,
    world: renderWorld,
    job_lumberjack: () => renderJob(game, container, 'lumberjack'),
    job_fisher: () => renderJob(game, container, 'fisher'),
    job_miner: () => renderJob(game, container, 'miner'),
    job_farmer: () => renderJob(game, container, 'farmer'),
    job_alchemist: () => renderJob(game, container, 'alchemist'),
    inventory: renderInventory,
    auction_house: renderAuctionHouse,
    leaderboard: renderLeaderboard,
    admin: renderAdmin,
    options: renderOptions,
    combat: renderCombat,
  };

  const fn = renderers[viewId] || renderCharacter;
  if (!renderers[viewId] && isFarmView(viewId)) {
    const buildingId = viewId.slice(5);
    renderFarmBuilding(game, container, buildingId);
    return;
  }
  fn(game, container);
}

const JOB_SWITCHER_STATUS_CLASSES = [
  'nav-harvest-ready',
  'nav-harvest-harvesting',
  'nav-harvest-regrowing',
  'nav-harvest-empty',
];

function getJobSwitcherGroup(viewId, state, balance, jobs = {}) {
  if (!viewId?.startsWith('job_') && !isFarmView(viewId)) return null;
  return {
    type: 'quick',
    items: getJobSwitcherItems(state, balance, jobs),
  };
}

function renderJobSwitcherLockedChip(game, entry) {
  const pct = Math.floor((entry.progress || 0) * 100);
  const gateName = game.jobs[entry.gateJob]?.name || entry.gateJob;
  const icon = getJobIcon(entry.jobId);
  const iconPart = icon
    ? iconHtml(icon, 'job-switcher-icon job-switcher-icon-locked', entry.label)
    : `<span class="job-switcher-emoji">${entry.emoji || '🔒'}</span>`;

  return `
    <button type="button" class="job-switcher-chip job-switcher-chip-locked${entry.ready ? ' job-switcher-chip-ready' : ''}" data-view="${entry.viewId}" aria-label="${entry.label} — ${gateName} Nv.${entry.currentLevel}/${entry.requiredLevel}" title="${entry.hint || ''}">
      <span class="job-switcher-chip-inner">
        ${iconPart}
        <span class="job-switcher-label">${entry.label}</span>
        <span class="job-switcher-level">${entry.ready ? 'Prêt' : `${entry.currentLevel}/${entry.requiredLevel}`}</span>
        <span class="job-switcher-unlock-bar"><span class="job-switcher-unlock-fill" style="width:${pct}%"></span></span>
      </span>
    </button>
  `;
}

function renderJobSwitcherChip(game, viewId, activeViewId) {
  const view = VIEWS[viewId];
  if (!view) return '';

  const isActive = viewId === activeViewId;
  let level = '';
  let status = 'empty';

  if (view.job) {
    level = String(game.getJobLevel(view.job));
    status = game.getJobHarvestNavStatus(view.job);
  } else if (view.building) {
    level = view.building === 'well'
      ? '—'
      : String(game.getFarmBuildingLevel(view.building));
    status = game.getFarmBuildingNavStatus(view.building);
  }

  const icon = getNavIcon(viewId) || (view.job ? getJobIcon(view.job) : getFarmBuildingIcon(view.building));
  const iconPart = icon
    ? iconHtml(icon, 'job-switcher-icon', view.label)
    : `<span class="job-switcher-emoji">${view.emoji || '·'}</span>`;

  return `
    <button type="button" class="job-switcher-chip nav-harvest-${status}${isActive ? ' active' : ''}" data-view="${viewId}" aria-label="${view.label}" aria-current="${isActive ? 'true' : 'false'}">
      <span class="job-switcher-chip-inner">
        ${iconPart}
        <span class="job-switcher-label">${view.label}</span>
        <span class="job-switcher-level">Nv.${level}</span>
        <span class="job-switcher-dot" aria-hidden="true"></span>
      </span>
    </button>
  `;
}

function getAdjacentVisibleView(viewId, visibleViews, direction) {
  if (!visibleViews?.length) return null;
  const idx = visibleViews.indexOf(viewId);
  if (idx < 0 || visibleViews.length <= 1) return null;
  const next = (idx + direction + visibleViews.length) % visibleViews.length;
  return visibleViews[next];
}

export function renderJobSwitcherDock(game, el, viewId) {
  if (!el) return;

  const group = getJobSwitcherGroup(viewId, game.state, game.balance, game.jobs);
  if (!group) {
    el.classList.add('hidden');
    el.innerHTML = '';
    document.body.classList.remove('has-job-switcher');
    return;
  }

  document.body.classList.add('has-job-switcher');
  el.classList.remove('hidden');
  el.dataset.switcherType = group.type;
  el.setAttribute(
    'aria-label',
    'Accès rapide récolte et ferme'
  );

  const chipsHtml = group.items.map((item) => {
    if (item.kind === 'lockedJob') return renderJobSwitcherLockedChip(game, item.entry);
    return renderJobSwitcherChip(game, item.viewId, viewId);
  }).join('');

  el.innerHTML = `<div class="job-switcher-scroll" role="list">${chipsHtml}</div>`;

  el.querySelectorAll('.job-switcher-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      if (target && target !== getView()) navigate(target);
    });
  });

  requestAnimationFrame(() => {
    el.querySelector('.job-switcher-chip.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
}

export function updateJobSwitcherDockStatus(game) {
  const el = document.getElementById('job-switcher-dock');
  if (!el || el.classList.contains('hidden')) return;

  const view = getView();
  el.querySelectorAll('.job-switcher-chip').forEach((btn) => {
    const vid = btn.dataset.view;
    if (btn.classList.contains('job-switcher-chip-locked')) return;

    const viewDef = VIEWS[vid];
    const isActive = vid === view;

    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    btn.classList.remove(...JOB_SWITCHER_STATUS_CLASSES);

    let status = 'empty';
    if (viewDef?.job) status = game.getJobHarvestNavStatus(viewDef.job);
    else if (viewDef?.building) status = game.getFarmBuildingNavStatus(viewDef.building);

    btn.classList.add(`nav-harvest-${status}`);
    btn.dataset.harvestStatus = status;
  });
}

/* ── Personnage ── */
function renderCompanionEquipPicker(game, companionId, slotFilter, container, companionSlots) {
  const s = game.state;
  const equippable = game.getCompanionOwnedItems(companionId).filter((ref) => {
    if (!slotFilter) return true;
    const item = resolveItem(s, ref, game.combatEquipment.items);
    return item?.slot === slotFilter;
  });

  if (slotFilter) {
    const slotDef = companionSlots[slotFilter];
    container.innerHTML = `<p class="companion-equip-hint">Choisir pour ${slotDef?.emoji || ''} ${slotDef?.name || slotFilter}</p>`;
  } else {
    container.innerHTML = '';
  }

  if (equippable.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-text';
    empty.style.padding = '0';
    empty.textContent = slotFilter
      ? 'Aucun objet compatible pour ce slot.'
      : 'Aucun objet compatible en réserve.';
    container.appendChild(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'companion-equip-chips';
  for (const ref of equippable) {
    const item = resolveItem(s, ref, game.combatEquipment.items);
    const slotDef = companionSlots[item.slot] || game.combatEquipment.slots[item.slot];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small btn-companion-equip';
    btn.textContent = `${item.emoji} ${game.getCombatItemLabel(ref)} (${slotDef?.name || item.slot})`;
    btn.addEventListener('click', () => game.doEquipCompanion(companionId, ref));
    wrap.appendChild(btn);
  }
  container.appendChild(wrap);
}

function renderCharStatPills(stats) {
  return `
    <div class="char-stat-pills" aria-label="Statistiques">
      <span class="char-stat-pill">❤️ ${stats.hp}</span>
      <span class="char-stat-pill">⚔️ ${stats.atk}</span>
      <span class="char-stat-pill">🛡️ ${stats.def}</span>
    </div>
  `;
}

function renderCharacter(game, el) {
  charTab = normalizeCharTab(charTab);
  const s = game.state;
  const zone = game.getCurrentZone();
  const p = s.prestige || {};
  const charProg = game.getCharacterProgress();
  const charPct = Math.min(100, (charProg.xp / charProg.needed) * 100);
  const displayName = game.getCharacterDisplayName();
  const nickInfo = game.getNicknameRenameInfo();
  const maxLen = game.characterConfig.nicknameMaxLength || 20;
  const statsBreakdown = game.getCharacterStatsBreakdown();
  const careerPending = game.needsCareerChoice();

  let nicknameHtml = '';
  if (careerPending) {
    nicknameHtml = '<p class="char-career-hint">Complète la fenêtre « Choisis ta voie » pour commencer à jouer.</p>';
  } else if (!nickInfo.hasNickname) {
    nicknameHtml = `
      <div class="nickname-form char-nickname-form">
        <label class="nickname-label" for="nickname-input">Pseudo</label>
        <div class="nickname-row">
          <input id="nickname-input" class="nickname-input" type="text" maxlength="${maxLen}" placeholder="Ex. Kira" />
          <button type="button" class="btn btn-small btn-craft" id="nickname-set">Valider</button>
        </div>
      </div>
    `;
  } else if (hasFreeRenameAvailable() && nickInfo.hasNickname) {
    nicknameHtml = `
      <details class="nickname-rename-details">
        <summary>Changer de pseudo (gratuit, 1 fois)</summary>
        <p class="nickname-hint">Synchronisé avec ton compte, classement et HDV.</p>
        <div class="nickname-row">
          <input id="nickname-free-rename-input" class="nickname-input" type="text" maxlength="${maxLen}" placeholder="Nouveau pseudo" value="${displayName}" />
          <button type="button" class="btn btn-small btn-craft" id="nickname-free-rename">Valider</button>
        </div>
      </details>
    `;
  } else if (nickInfo.canRename) {
    nicknameHtml = `
      <details class="nickname-rename-details">
        <summary>Renommer (${formatNumber(nickInfo.cost)} 💰)</summary>
        <div class="nickname-row">
          <input id="nickname-rename-input" class="nickname-input" type="text" maxlength="${maxLen}" placeholder="Nouveau pseudo" />
          <button type="button" class="btn btn-small btn-muted" id="nickname-rename">${formatNumber(nickInfo.cost)} 💰</button>
        </div>
      </details>
    `;
  }

  el.innerHTML = `
    ${renderGuestBanner(game)}
    <div class="char-page">
      <div class="prestige-teaser" id="char-prestige-teaser"></div>
      <section class="char-hero panel-inner">
        <div class="char-hero-layout">
          <div class="char-hero-main">
            <h2 class="char-display-name">${displayName}</h2>
            ${nicknameHtml}
            <p class="char-hero-sub">Saison ${s.season || 1} · ${zone?.emoji || ''} ${zone?.name || ''} · Nv.${charProg.level}${charProg.seasonCap ? ` / ${charProg.seasonCap}` : ''}</p>
            <div class="char-xp-row">
              <div class="xp-bar-container"><div class="xp-bar" style="width:${charPct}%"></div></div>
              <span class="xp-text">${charProg.atSeasonCap ? `Plafond Saison ${s.season || 1}` : `${charProg.xp} / ${charProg.needed} XP`}</span>
            </div>
            ${renderCharStatPills(statsBreakdown.total)}
            <p class="char-bonus-line">Bonus saison : +${Math.round((p.kirhaBonus || 0) * 100)}% 💰 · +${Math.round((p.xpBonus || 0) * 100)}% XP</p>
            <button class="btn btn-muted btn-small char-combat-link" id="goto-combat" type="button">⚔️ Zones de combat</button>
          </div>
          <div class="char-equip-wrap">
            <p class="char-section-label">Équipement</p>
            <div class="char-dofus-equip-grid" id="char-dofus-equip"></div>
          </div>
        </div>
      </section>
      <nav class="char-tabs" role="tablist" aria-label="Sections personnage">
        <button type="button" class="char-tab-btn${charTab === 'bag' ? ' active' : ''}" data-tab="bag" role="tab">Sac</button>
        <button type="button" class="char-tab-btn${charTab === 'gear' ? ' active' : ''}" data-tab="gear" role="tab">Équipement</button>
        <button type="button" class="char-tab-btn${charTab === 'tools' ? ' active' : ''}" data-tab="tools" role="tab">Outils</button>
        <button type="button" class="char-tab-btn${charTab === 'team' ? ' active' : ''}" data-tab="team" role="tab">Équipe</button>
      </nav>
      <div class="char-tab-panel panel-inner" id="char-tab-panel"></div>
    </div>
  `;

  renderCharDofusEquipGrid(game, el.querySelector('#char-dofus-equip'));
  renderPrestigeTeaser(game, el.querySelector('#char-prestige-teaser'));

  el.querySelector('#guest-upgrade-hdv')?.addEventListener('click', () => showAccountRequiredModal(getOnlineBlockReason()));
  el.querySelector('#goto-combat')?.addEventListener('click', () => navigate('combat'));

  el.querySelector('#nickname-set')?.addEventListener('click', () => {
    const input = el.querySelector('#nickname-input');
    const result = game.setCharacterNickname(input?.value || '', false);
    if (!result.ok && result.reason) emit('nicknameError', { reason: result.reason });
  });

  el.querySelector('#nickname-rename')?.addEventListener('click', () => {
    const input = el.querySelector('#nickname-rename-input');
    const result = game.setCharacterNickname(input?.value || '', true);
    if (!result.ok && result.reason) emit('nicknameError', { reason: result.reason });
  });

  el.querySelector('#nickname-free-rename')?.addEventListener('click', async () => {
    const input = el.querySelector('#nickname-free-rename-input');
    const result = await changeDisplayNameFree(input?.value || '', game.characterConfig);
    if (!result.ok) {
      emit('nicknameError', { reason: result.reason });
      return;
    }
    const name = result.data?.display_name || input?.value?.trim();
    applyServerDisplayNameToGame(game, name);
    await refreshProfile();
    game.scheduleSave?.();
    emit('nicknameChange', { name, renamed: true, free: true });
    emit('stateChange', game.state);
    renderCharacter(game, el);
  });

  el.querySelectorAll('.char-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      charTab = normalizeCharTab(btn.dataset.tab);
      el.querySelectorAll('.char-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === charTab));
      renderCharTabPanel(game, el);
    });
  });

  renderCharTabPanel(game, el);
}

function renderCharTabPanel(game, el) {
  const panel = el.querySelector('#char-tab-panel');
  if (!panel) return;
  panel.innerHTML = '';
  if (charTab === 'bag') renderCharBagTab(game, panel);
  else if (charTab === 'gear') renderCharGearTab(game, panel);
  else if (charTab === 'tools') renderCharToolsTab(game, panel);
  else if (charTab === 'team') renderCharTeamTab(game, panel);
}

function renderCharGearTab(game, panel) {
  panel.innerHTML = `
    <p class="view-desc char-gear-hint">Pièces droppées en combat — équipe-les sur les slots ci-dessus.</p>
    <div id="combat-owned-reserve" class="char-gear-list"></div>
  `;
  renderCombatOwnedReserve(game, panel.querySelector('#combat-owned-reserve'));
}

function renderCharStatsComparison(statsBreakdown) {
  const rows = [
    { label: 'Sans équipement', values: statsBreakdown.base, cls: 'base' },
    { label: 'Gain équipement', values: statsBreakdown.equipment, cls: 'gain', prefix: '+' },
    { label: 'Total équipé', values: statsBreakdown.total, cls: 'total' },
  ];
  return `
    <div class="char-stat-compare" aria-label="Comparaison des statistiques">
      ${rows.map((row) => `
        <div class="char-stat-compare-row char-stat-${row.cls}">
          <span>${row.label}</span>
          <strong>❤️ ${row.prefix || ''}${row.values.hp} · ⚔️ ${row.prefix || ''}${row.values.atk} · 🛡️ ${row.prefix || ''}${row.values.def}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

const DOFUS_SLOT_LAYOUT = [
  { id: 'helmet', area: 'helmet' },
  { id: 'cape', area: 'cape' },
  { id: 'portrait', area: 'portrait', isPortrait: true },
  { id: 'amulet', area: 'amulet' },
  { id: 'weapon', area: 'weapon' },
  { id: 'chest', area: 'chest' },
  { id: 'boots', area: 'boots' },
  { id: 'ring_left', area: 'ringl' },
  { id: 'belt', area: 'belt' },
  { id: 'ring_right', area: 'ringr' },
];

function formatCombatItemStatsLine(stats) {
  if (!stats) return '';
  return [
    stats.hp ? `+${stats.hp} PV` : '',
    stats.atk ? `+${stats.atk} ATQ` : '',
    stats.def ? `+${stats.def} DEF` : '',
  ].filter(Boolean).join(' · ');
}

function getHeroCombatItemsForSlot(game, slotId) {
  const s = game.state;
  const equippedRef = s.combatEquipment?.[slotId] || null;
  const items = [];
  for (const ref of s.ownedCombatItems || []) {
    const item = resolveItem(s, ref, game.combatEquipment.items);
    if (!item || item.slot !== slotId || item.companionOnly) continue;
    const owner = findCombatItemOwner(s, ref);
    if (owner && owner !== 'hero') continue;
    if (ref !== equippedRef && !canEquipCombatItem(s, ref, game.combatEquipment.items)) continue;
    items.push({ ref, item, equipped: ref === equippedRef });
  }
  items.sort((a, b) => {
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    return a.item.name.localeCompare(b.item.name, 'fr');
  });
  return items;
}

function closeCharEquipPicker() {
  document.getElementById('char-equip-sheet-backdrop')?.classList.remove('active');
  document.getElementById('char-equip-sheet')?.classList.remove('active');
  document.body.classList.remove('char-equip-sheet-open');
  document.getElementById('char-equip-sheet')?.replaceChildren();
}

function ensureCharEquipPickerNodes() {
  if (!document.getElementById('char-equip-sheet-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'char-equip-sheet-backdrop';
    backdrop.className = 'hdv-sheet-backdrop char-equip-sheet-backdrop';
    backdrop.addEventListener('click', closeCharEquipPicker);
    document.body.appendChild(backdrop);
  }
  if (!document.getElementById('char-equip-sheet')) {
    const sheet = document.createElement('div');
    sheet.id = 'char-equip-sheet';
    sheet.className = 'hdv-sheet char-equip-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    document.body.appendChild(sheet);
  }
}

function openCharEquipPicker(game, slotId) {
  ensureCharEquipPickerNodes();
  const sheet = document.getElementById('char-equip-sheet');
  const backdrop = document.getElementById('char-equip-sheet-backdrop');
  const slotDef = game.combatEquipment.slots[slotId];
  if (!sheet || !backdrop || !slotDef) return;

  const s = game.state;
  const equippedRef = s.combatEquipment?.[slotId] || null;
  const candidates = getHeroCombatItemsForSlot(game, slotId);
  const reserveCount = candidates.filter((entry) => !entry.equipped).length;

  const renderRows = () => candidates.map(({ ref, item, equipped }) => {
    const inst = s.combatItemInstances?.find((i) => i.instanceId === ref);
    const rarity = getInstanceRarity(inst);
    const stats = getInstanceEffectiveStats(s, ref, game.combatEquipment.items);
    const statsLine = formatCombatItemStatsLine(stats);
    return `
      <button type="button" class="char-equip-picker-row${equipped ? ' equipped' : ''}" data-ref="${ref}" ${equipped ? 'disabled' : ''}>
        <span class="char-equip-picker-row-main">
          <span class="char-equip-picker-emoji">${item.emoji || '⚔️'}</span>
          <span class="char-equip-picker-info">
            <strong class="char-equip-picker-name">${item.name}</strong>
            <span class="char-equip-picker-meta">${RARITY_EMOJI[rarity] || ''} ${RARITY_LABELS[rarity] || ''}${statsLine ? ` · ${statsLine}` : ''}</span>
          </span>
        </span>
        <span class="char-equip-picker-action">${equipped ? 'Équipé' : 'Équiper'}</span>
      </button>
    `;
  }).join('');

  sheet.innerHTML = `
    <div class="hdv-sheet-header">
      <div>
        <p class="hdv-sheet-kicker">Emplacement</p>
        <h3 class="hdv-sheet-title">${slotDef.emoji || ''} ${slotDef.name}</h3>
        <p class="hdv-sheet-meta">${reserveCount ? `${reserveCount} pièce${reserveCount > 1 ? 's' : ''} en réserve` : 'Aucune pièce en réserve'}</p>
      </div>
      <button type="button" class="hdv-sheet-close char-equip-sheet-close" aria-label="Fermer">✕</button>
    </div>
    ${equippedRef ? `
      <button type="button" class="btn btn-muted btn-small char-equip-picker-unequip" id="char-equip-unequip">
        Retirer l'équipement actuel
      </button>
    ` : ''}
    <div class="char-equip-picker-list">
      ${candidates.length
    ? renderRows()
    : '<p class="char-equip-picker-empty">Aucune pièce pour cet emplacement.<br>Farm les donjons pour en obtenir.</p>'}
    </div>
  `;

  sheet.querySelector('.char-equip-sheet-close')?.addEventListener('click', closeCharEquipPicker);
  sheet.querySelector('#char-equip-unequip')?.addEventListener('click', () => {
    game.doUnequipCombat(slotId);
    refreshCharacterCombatPanels(game);
    openCharEquipPicker(game, slotId);
  });
  sheet.querySelectorAll('.char-equip-picker-row:not([disabled])').forEach((row) => {
    row.addEventListener('click', () => {
      const ref = row.dataset.ref;
      if (!ref || !game.doEquipCombat(ref)) {
        emit('farmBlocked', { message: 'Équipement impossible.' });
        return;
      }
      closeCharEquipPicker();
      refreshCharacterCombatPanels(game);
    });
  });

  backdrop.classList.add('active');
  sheet.classList.add('active');
  document.body.classList.add('char-equip-sheet-open');
}

export function closeCharEquipPickerSheet() {
  closeCharEquipPicker();
}

function renderCharDofusEquipGrid(game, container) {
  if (!container) return;
  const s = game.state;
  container.innerHTML = '';
  for (const entry of DOFUS_SLOT_LAYOUT) {
    const cell = document.createElement('div');
    cell.className = `char-equip-slot char-equip-${entry.area}`;
    if (entry.isPortrait) {
      cell.innerHTML = `<div class="char-portrait char-dofus-portrait">${iconHtml(getNavIcon('character'), 'char-portrait-icon', 'Personnage')}</div>`;
      container.appendChild(cell);
      continue;
    }
    const slot = game.combatEquipment.slots[entry.id];
    if (!slot || slot.companionOnly) continue;
    const ref = s.combatEquipment?.[entry.id];
    const item = ref ? resolveItem(s, ref, game.combatEquipment.items) : null;
    const statsLine = item?.stats
      ? [
        item.stats.hp ? `+${item.stats.hp} PV` : '',
        item.stats.atk ? `+${item.stats.atk} ATQ` : '',
        item.stats.def ? `+${item.stats.def} DEF` : '',
      ].filter(Boolean).join(' · ')
      : '';
    if (item) cell.classList.add('filled');
    cell.innerHTML = `
      <span class="char-equip-slot-label">${slot.emoji}</span>
      ${item
        ? `<span class="char-equip-item" title="${item.name}">${item.emoji}</span><span class="char-equip-name">${item.name}</span>${statsLine ? `<span class="char-equip-stats">${statsLine}</span>` : ''}`
        : `<span class="char-equip-empty">${slot.name}</span>`}
    `;
    if (item) {
      cell.title = `${item.name} · +${item.stats?.hp || 0} HP · +${item.stats?.atk || 0} ATQ · +${item.stats?.def || 0} DEF`;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'char-equip-slot-btn';
    btn.setAttribute('aria-label', item ? `Changer ${slot.name}` : `Équiper ${slot.name}`);
    btn.addEventListener('click', () => openCharEquipPicker(game, entry.id));
    cell.appendChild(btn);
    container.appendChild(cell);
  }
}


function renderFusionPanel(game, container) {
  if (!container) return;
  const groups = game.getFusionGroups();
  if (!groups.length) {
    container.innerHTML = '<h3>🔮 Fusion</h3><p class="view-desc">Aucune pièce fusionnable (réserve ou équipée).</p>';
    return;
  }
  container.innerHTML = '<h3>🔮 Fusion</h3><p class="view-desc">Fusionne des pièces identiques pour monter en rareté — les stats augmentent à chaque palier.</p>' + groups.map((g) => {
    const key = `${g.itemId}::${g.rarity}`;
    const need = getFusionInputCount(g.rarity);
    const check = canFuseGroup(g, game.balance);
    const cost = getFusionKirhaCost(g.rarity, game.balance);
    const nextRarity = getNextRarity(g.rarity) || '—';
    const item = g.item;
    const curStats = item?.stats ? `PV+${item.stats.hp || 0} ATQ+${item.stats.atk || 0} DEF+${item.stats.def || 0}` : '';
    return `<div class="fusion-row"><span>${g.item.emoji} ${g.item.name} ${RARITY_EMOJI[g.rarity] || ''} · ${g.refs.length}/${need}<br><small>${curStats} → ${RARITY_LABELS[nextRarity] || nextRarity}</small></span><button type="button" class="btn btn-craft btn-fusion" data-fusion="${key}" ${check.ok ? '' : 'disabled'}>Fusionner (${cost} 💰)</button></div>`;
  }).join('');
  container.querySelectorAll('.btn-fusion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = game.doFuseEquipment(btn.dataset.fusion);
      if (!result.ok) {
        emit('farmBlocked', { message: result.reason || 'Fusion impossible' });
        return;
      }
      const viewEl = document.getElementById('view-container');
      if (viewEl && (getView() === 'workshop' || isWorkshopView(getView()))) {
        renderWorkshopHub(game, viewEl);
      } else if (viewEl && getView() === 'character') {
        renderCharacter(game, viewEl);
      }
    });
  });
}

function renderCombatOwnedReserve(game, container) {
  if (!container) return;
  const s = game.state;
  const owned = game.getOwnedCombatItems();
  container.innerHTML = '';
  if (!owned.length) {
    container.innerHTML = '<p class="empty-text">Aucune pièce en réserve — farm les donjons pour en obtenir.</p>';
    return;
  }
  for (const ref of owned) {
    const item = resolveItem(s, ref, game.combatEquipment.items);
    if (!item) continue;
    const wrap = document.createElement('div');
    wrap.className = 'char-gear-row';
    const stats = item.stats
      ? [item.stats.hp ? `+${item.stats.hp} PV` : '', item.stats.atk ? `+${item.stats.atk} ATQ` : '', item.stats.def ? `+${item.stats.def} DEF` : ''].filter(Boolean).join(' · ')
      : '';
    const rarity = getInstanceRarity(s.combatItemInstances?.find((i) => i.instanceId === ref));
    const sellPrice = game.getCombatItemSellPrice(ref);
    wrap.innerHTML = `
      <div class="char-gear-row-main">
        <span class="char-gear-emoji">${item.emoji || '⚔️'}</span>
        <div>
          <strong>${item.name}</strong> ${RARITY_EMOJI[rarity] || ''}
          ${stats ? `<span class="char-gear-stats">${stats}</span>` : ''}
        </div>
      </div>
    `;
    const equipBtn = document.createElement('button');
    equipBtn.type = 'button';
    equipBtn.className = 'btn btn-small btn-craft';
    equipBtn.textContent = 'Équiper';
    equipBtn.addEventListener('click', () => game.doEquipCombat(ref));
    wrap.appendChild(equipBtn);
    const sellBtn = document.createElement('button');
    sellBtn.type = 'button';
    sellBtn.className = 'btn btn-small btn-muted';
    sellBtn.textContent = `Vendre (${sellPrice} 💰)`;
    sellBtn.addEventListener('click', () => {
      const result = game.doSellCombatItem(ref);
      if (!result.ok) {
        emit('farmBlocked', { message: result.reason || 'Vente impossible' });
        return;
      }
      const viewEl = document.getElementById('view-container');
      if (viewEl && getView() === 'character') renderCharacter(game, viewEl);
    });
    wrap.appendChild(sellBtn);
    container.appendChild(wrap);
  }
}

let bagFilter = 'all';

function renderCharBagTab(game, panel) {
  panel.innerHTML = `
    <div class="bag-toolbar">
      <div class="bag-filters" role="tablist">
        <button type="button" class="bag-filter-btn${bagFilter === 'all' ? ' active' : ''}" data-filter="all">Tout</button>
        <button type="button" class="bag-filter-btn${bagFilter === 'resource' ? ' active' : ''}" data-filter="resource">Ressources</button>
        <button type="button" class="bag-filter-btn${bagFilter === 'craft' ? ' active' : ''}" data-filter="craft">Équipement</button>
        <button type="button" class="bag-filter-btn${bagFilter === 'combat' ? ' active' : ''}" data-filter="combat">Combat</button>
      </div>
      <span class="bank-total" id="char-bag-total"></span>
    </div>
    <div class="inventory-grid" id="char-bag-grid"></div>
    <p class="view-desc bag-hint">Repas : bouton <strong>Se soigner</strong> si PV bas. Équipement droppé : bouton <strong>Équiper</strong>.</p>
  `;
  panel.querySelectorAll('.bag-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      bagFilter = btn.dataset.filter;
      renderCharBagTab(game, panel);
    });
  });
  const totalEl = panel.querySelector('#char-bag-total');
  renderInventoryGrid(game, panel.querySelector('#char-bag-grid'), {
    filter: bagFilter,
    onTotal: (v) => { if (totalEl) totalEl.textContent = `Valeur : ${formatNumber(v)} 💰`; },
  });
}

function getInventoryMealInfo(game, resourceId) {
  if (!resourceId.startsWith('meal_')) return null;
  const effect = getMealEffect(resourceId, game.resources, game.balance);
  if (!effect) return null;

  const charLevel = game.state.character?.level || 1;
  const maxHp = game.getCharacterStats().hp;
  const storedHp = game.state.combatWear?.solo?.hero;
  const currentHp = storedHp != null ? storedHp : maxHp;
  const levelOk = charLevel >= effect.levelMin && charLevel <= effect.levelMax;
  const inCombat = !!game.state.combatEncounter;
  const canHeal = levelOk && !inCombat && currentHp < maxHp;
  let disabledReason = '';
  if (inCombat) disabledReason = 'En combat, utilise le menu Objets.';
  else if (!levelOk) disabledReason = `Réservé aux persos niv. ${effect.levelMin}–${effect.levelMax}.`;
  else if (currentHp >= maxHp) disabledReason = 'PV déjà au maximum.';

  return { effect, maxHp, currentHp, levelOk, inCombat, canHeal, disabledReason };
}

export function refreshCharacterCombatPanels(game) {
  const el = document.getElementById('view-container');
  if (!el || getView() !== 'character') return;
  renderCharDofusEquipGrid(game, el.querySelector('#char-dofus-equip'));
  const panel = el.querySelector('#char-tab-panel');
  if (panel && charTab === 'gear') renderCharGearTab(game, panel);
  if (panel && charTab === 'bag') renderCharBagTab(game, panel);
}

function refreshInventoryPanels(game) {
  const panel = document.querySelector('#char-tab-panel');
  const bankEl = document.getElementById('view-container');
  if (panel) renderCharBagTab(game, panel);
  else if (bankEl && getView() === 'inventory') renderInventory(game, bankEl);
  refreshCharacterCombatPanels(game);
  refreshAuctionHouseLight(game);
}

function appendOwnedCombatItemsToGrid(game, container, filter) {
  if (!container || (filter !== 'all' && filter !== 'combat')) return 0;
  let count = 0;
  const s = game.state;
  for (const ref of game.getOwnedCombatItems()) {
    const item = resolveItem(s, ref, game.combatEquipment.items);
    if (!item) continue;
    count += 1;
    const cell = document.createElement('div');
    cell.className = 'inventory-grid-cell combat-gear';
    cell.title = item.name;
    cell.innerHTML = `
      <span class="inventory-grid-emoji">${item.emoji || '⚔️'}</span>
      <span class="inventory-grid-combat-name">${item.name}</span>
    `;
    const equipBtn = document.createElement('button');
    equipBtn.type = 'button';
    equipBtn.className = 'inventory-meal-heal-btn affordable';
    equipBtn.textContent = 'Équiper';
    equipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!game.doEquipCombat(ref)) {
        emit('farmBlocked', { message: 'Équipement impossible.' });
        return;
      }
      refreshInventoryPanels(game);
    });
    cell.appendChild(equipBtn);
    const sellPrice = game.getCombatItemSellPrice(ref);
    const sellBtn = document.createElement('button');
    sellBtn.type = 'button';
    sellBtn.className = 'inventory-meal-heal-btn';
    sellBtn.textContent = `Vendre ${sellPrice}💰`;
    sellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const result = game.doSellCombatItem(ref);
      if (!result.ok) {
        emit('farmBlocked', { message: result.reason || 'Vente impossible' });
        return;
      }
      refreshInventoryPanels(game);
    });
    cell.appendChild(sellBtn);
    container.appendChild(cell);
  }
  return count;
}

function renderCharToolsTab(game, panel) {
  panel.innerHTML = `
    <p class="view-desc char-tools-desc">Outils de récolte équipés ou en réserve. Pour l’élevage : tu peux équiper le <strong>seau</strong> et le <strong>panier</strong> en même temps (eau + productions animales).</p>
    <div id="char-gather-equip" class="char-tools-list"></div>
  `;
  const gatherEl = panel.querySelector('#char-gather-equip');
  const tools = getOwnedGatheringEquipment(game.state, game.equipment, game.recipes, game.jobs);
  const equipped = tools.filter((t) => t.equipped);
  const reserve = tools.filter((t) => !t.equipped);
  if (!equipped.length && !reserve.length) {
    gatherEl.innerHTML = '<p class="empty-text">Aucun outil — fabrique-les à l\'Atelier Outilleur.</p>';
    return;
  }
  if (equipped.length) {
    const title = document.createElement('div');
    title.className = 'char-tools-subtitle';
    title.textContent = 'Équipés';
    gatherEl.appendChild(title);
    const wrap = document.createElement('div');
    wrap.className = 'char-tools-group';
    for (const entry of equipped) appendGatheringToolRow(game, wrap, entry, { showUnequip: true });
    gatherEl.appendChild(wrap);
  }
  if (reserve.length) {
    const title = document.createElement('div');
    title.className = 'char-tools-subtitle';
    title.textContent = 'Réserve';
    gatherEl.appendChild(title);
    const wrap = document.createElement('div');
    wrap.className = 'char-tools-group';
    for (const entry of reserve) appendGatheringToolRow(game, wrap, entry, { showEquip: true });
    gatherEl.appendChild(wrap);
  }
}

function appendGatheringToolRow(game, container, entry, { showUnequip = false, showEquip = false } = {}) {
  const s = game.state;
  const { recipeId, recipe, jobEmoji, jobName, slotKind, broken } = entry;
  const slotIcon = slotKind === 'accessory' ? '🧰' : (slotKind === 'basket' ? '🧺' : (slotKind === 'bucket' ? '🪣' : '🛠️'));
  const slotLabel = slotKind === 'basket' ? 'Panier' : (slotKind === 'bucket' ? 'Seau' : (slotKind === 'accessory' ? 'Accessoire' : 'Outil'));
  const row = document.createElement('div');
  row.className = `char-tool-row${entry.equipped ? ' char-tool-equipped' : ''}${broken ? ' char-tool-broken' : ''}`;

  const main = document.createElement('div');
  main.className = 'char-tool-main';
  main.innerHTML = `
    <span class="char-tool-name">${recipe.emoji} ${recipe.name}</span>
    <span class="char-tool-meta">${slotIcon} ${slotLabel} · ${jobEmoji} ${jobName}</span>
  `;
  if (isDurabilityTool(recipe)) {
    main.insertAdjacentHTML('beforeend', renderDurabilityBar(s, recipeId, recipe));
  }
  row.appendChild(main);

  const actions = document.createElement('div');
  actions.className = 'char-tool-actions';
  if (showUnequip && entry.equipped) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small';
    btn.textContent = 'Retirer';
    let unequipKind = slotKind === 'global' ? 'global' : slotKind;
    const jobId = slotKind === 'global' ? 'global' : entry.jobId;
    if (entry.jobId === 'breeder' && (slotKind === 'tool' || slotKind === 'bucket' || slotKind === 'basket')) {
      unequipKind = recipe?.toolKind || (String(recipeId).includes('basket') ? 'basket' : 'bucket');
    }
    btn.addEventListener('click', () => game.doUnequip(jobId, unequipKind));
    actions.appendChild(btn);
  }
  if (showEquip && entry.canEquip) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small btn-craft';
    btn.textContent = 'Équiper';
    btn.addEventListener('click', () => game.doEquip(recipeId));
    actions.appendChild(btn);
  } else if (showEquip && broken) {
    const hint = document.createElement('span');
    hint.className = 'char-tool-hint';
    hint.textContent = 'Usé — refabrique à l\'Atelier';
    actions.appendChild(hint);
  }
  if (actions.children.length) row.appendChild(actions);
  container.appendChild(row);
}

function renderCharJobsTab(game, panel) {
  panel.innerHTML = `
    <h3>📜 Métiers de récolte</h3>
    <div id="char-jobs"></div>
    <h3 class="char-subsection-title">👨‍🍳 Cuisine</h3>
    <div id="char-cuisine-job"></div>
  `;

  const jobsEl = panel.querySelector('#char-jobs');
  for (const job of game.getGatheringJobs()) {
    const prog = game.getJobProgress(job.id);
    const pct = (prog.xp / prog.needed) * 100;
    const harvesting = game.isJobHarvesting(job.id);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'job-row job-row-link';
    const jobLead = job.icon
      ? iconHtml(job.icon, 'job-row-icon', job.name)
      : `<span class="job-row-emoji">${job.emoji}</span>`;
    row.innerHTML = `
      <span>${jobLead} ${job.name} <strong>Nv.${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}</strong>${harvesting ? ' <span style="color:var(--vert-clair)">● actif</span>' : ''}</span>
      <div class="xp-bar-container"><div class="xp-bar" style="width:${pct}%"></div></div>
    `;
    row.addEventListener('click', () => navigate(JOB_VIEW_MAP[job.id] || 'character'));
    jobsEl.appendChild(row);
  }

  const cuisineJob = game.getCuisineJob?.();
  const cuisineEl = panel.querySelector('#char-cuisine-job');
  if (cuisineJob && cuisineEl) {
    const prog = game.getJobProgress(cuisineJob.id);
    const pct = (prog.xp / prog.needed) * 100;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'job-row job-row-link';
    const jobLead = cuisineJob.icon
      ? iconHtml(cuisineJob.icon, 'job-row-icon', cuisineJob.name)
      : `<span class="job-row-emoji">${cuisineJob.emoji}</span>`;
    row.innerHTML = `
      <span>${jobLead} ${cuisineJob.name} <strong>Nv.${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}</strong></span>
      <div class="xp-bar-container"><div class="xp-bar" style="width:${pct}%"></div></div>
    `;
    row.addEventListener('click', () => navigate('cuisine'));
    cuisineEl.appendChild(row);
  }
}

function renderCharHelpTab(panel) {
  panel.innerHTML = `
    <h3>📘 Infos & conseils</h3>
    <div class="help-grid">
      <section class="help-card">
        <h4>🌱 Voie de départ</h4>
        <p>Tu choisis 2 métiers de récolte et 2 bâtiments de ferme. Le reste se récupère via la Place marchande.</p>
      </section>
      <section class="help-card">
        <h4>🏛️ Place marchande</h4>
        <p>Utilise les catégories pour acheter les ressources que tu ne produis pas. Vends tes surplus à la Banque pour financer les achats.</p>
      </section>
      <section class="help-card">
        <h4>🛠️ Outilleur</h4>
        <p>L'atelier affiche seulement les outils utiles à ta voie. Les outils augmentent vitesse, rendement et confort de progression.</p>
      </section>
      <section class="help-card">
        <h4>🍱 Nourriture</h4>
        <p>Prépare des repas avant les donjons. Les zones après le début sont pensées pour être très dures sans soins.</p>
      </section>
      <section class="help-card">
        <h4>⚔️ Combat</h4>
        <p>Guerrier = défense, Archer = attaque, Mage = mixte. Change ton équipement selon la zone et garde de la nourriture en réserve.</p>
      </section>
      <section class="help-card">
        <h4>📱 Mobile</h4>
        <p>Le menu rapide du bas donne accès aux métiers de récolte et bâtiments de ferme choisis sans rouvrir toute la navigation.</p>
      </section>
    </div>
  `;
}

function renderCharTeamTab(game, panel) {
  const s = game.state;
  const charProg = game.getCharacterProgress();
  const companionSlots = {
    weapon: game.combatEquipment.slots.weapon,
    companion_armor: game.combatEquipment.slots.companion_armor,
    companion_charm: game.combatEquipment.slots.companion_charm,
  };

  panel.innerHTML = `
    <h3>👥 Équipe</h3>
    <p class="view-desc">Touche un slot pour équiper ou retirer. « En combat » / « En réserve » choisit s'il participe aux donjons.</p>
    <div id="companions-list"></div>
  `;

  const companionsEl = panel.querySelector('#companions-list');
  for (const def of Object.values(game.companions)) {
    const compState = s.companions?.[def.id];
    const card = document.createElement('div');
    card.className = `companion-card${compState?.unlocked ? ' unlocked' : ''}`;

    if (!compState?.unlocked) {
      const check = game.canUnlockCompanion(def.id);
      const assignedRole = compState?.assignedWeaponType
        ? (game.weaponRoles?.[compState.assignedWeaponType]?.label || compState.assignedWeaponType)
        : '';
      card.innerHTML = `
        <div class="companion-head">
          <span class="companion-emoji">${def.emoji}</span>
          <div>
            <strong>${def.name}</strong>
            <p class="view-desc">${def.description}</p>
            ${assignedRole ? `<p class="view-desc">Rôle prévu : ${assignedRole}</p>` : ''}
          </div>
        </div>
        <button type="button" class="btn btn-craft btn-unlock-companion" ${check.ok ? '' : 'disabled'}>
          Recruter · ${formatNumber(def.unlockCost)} 💰
        </button>
        ${!check.ok && check.reason ? `<p class="nickname-hint">${check.reason}</p>` : ''}
      `;
      card.querySelector('.btn-unlock-companion')?.addEventListener('click', () => {
        const result = game.doUnlockCompanion(def.id);
        if (!result.ok && result.reason) emit('nicknameError', { reason: result.reason });
      });
      companionsEl.appendChild(card);
      continue;
    }

    const stats = game.getCompanionStatsFor(def.id);
    const eq = compState.equipment || {};
    const inParty = compState.activeInParty !== false;
    const displayName = game.getCompanionDisplayName(def.id);
    const hasNick = !!compState.nickname?.trim();
    const maxLen = game.characterConfig.nicknameMaxLength || 20;

    card.innerHTML = `
      <div class="companion-head">
        <span class="companion-emoji">${def.emoji}</span>
        <div class="companion-head-text">
          <strong>${displayName}</strong>${hasNick ? `<span class="companion-base-name"> (${def.name})</span>` : ''}
          <p class="view-desc">Nv.${charProg.level} · ❤️ ${stats.hp} · ⚔️ ${stats.atk} · 🛡️ ${stats.def}</p>
        </div>
        <button type="button" class="btn btn-small btn-party-toggle${inParty ? ' active' : ''}" data-companion="${def.id}">
          ${inParty ? 'En combat' : 'En réserve'}
        </button>
      </div>
      <div class="companion-nickname-row">
        <input type="text" class="nickname-input companion-nick-input" maxlength="${maxLen}" placeholder="Pseudo de l'équipier" value="${compState.nickname || ''}" data-companion="${def.id}" />
        <button type="button" class="btn btn-small btn-muted btn-comp-nick" data-companion="${def.id}">${hasNick ? 'Renommer' : 'Valider'}</button>
      </div>
      <div class="companion-slots-grid"></div>
      <div class="companion-equip-actions" data-companion="${def.id}"></div>
    `;

    card.querySelector('.btn-comp-nick')?.addEventListener('click', () => {
      const input = card.querySelector('.companion-nick-input');
      const result = game.setCompanionNickname(def.id, input?.value || '', hasNick);
      if (!result.ok && result.reason) emit('nicknameError', { reason: result.reason });
    });

    card.querySelector('.btn-party-toggle')?.addEventListener('click', () => {
      game.doToggleCompanionParty(def.id);
    });

    const slotsGrid = card.querySelector('.companion-slots-grid');
    for (const [slotId, slotDef] of Object.entries(companionSlots)) {
      const ref = eq[slotId];
      const item = ref ? resolveItem(s, ref, game.combatEquipment.items) : null;
      const classTag = item?.slot === 'weapon' && item.className ? ` · ${item.className}` : '';
      const slotBtn = document.createElement('button');
      slotBtn.type = 'button';
      slotBtn.className = `companion-slot-card${item ? ' filled' : ''}`;
      slotBtn.dataset.slot = slotId;
      slotBtn.dataset.companion = def.id;
      slotBtn.innerHTML = `
        <span class="companion-slot-emoji">${slotDef.emoji}</span>
        <span class="companion-slot-name">${slotDef.name}</span>
        <span class="companion-slot-item">${item ? `${item.emoji} ${item.name}${classTag}` : 'Vide — toucher pour équiper'}</span>
      `;
      slotBtn.addEventListener('click', () => {
        if (item) {
          game.doUnequipCompanion(def.id, slotId);
          return;
        }
        const equipActions = card.querySelector('.companion-equip-actions');
        renderCompanionEquipPicker(game, def.id, slotId, equipActions, companionSlots);
        equipActions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      slotsGrid.appendChild(slotBtn);
    }

    const equipActions = card.querySelector('.companion-equip-actions');
    renderCompanionEquipPicker(game, def.id, null, equipActions, companionSlots);

    companionsEl.appendChild(card);
  }
}

function renderAchievements(game, el) {
  const byCat = getAchievementsByCategory(game.achievements, game.state, game.recipes);
  const bonuses = getAchievementBonuses(game.state);
  const bonusLine = (bonuses.kirha || bonuses.xp || bonuses.harvestSpeed)
    ? `<p class="view-desc">Bonus actifs : ${bonuses.kirha ? `+${(bonuses.kirha * 100).toFixed(0)} % Kirha ` : ''}${bonuses.xp ? `+${(bonuses.xp * 100).toFixed(0)} % XP ` : ''}${bonuses.harvestSpeed ? `+${(bonuses.harvestSpeed * 100).toFixed(0)} % vitesse récolte` : ''}</p>`
    : '';

  el.innerHTML = `
    <div class="view-header">
      <h2>🏆 Succès</h2>
      <p class="view-desc">Objectifs permanents — petits bonus cumulatifs. Certains succès Saison 1 sont requis pour passer à la Saison 2.</p>
      ${bonusLine}
    </div>
    <div id="achievements-list" class="panel-inner"></div>
  `;

  const list = el.querySelector('#achievements-list');
  const order = ['season_1', 'season_meta', 'harvest', 'craft', 'combat'];

  for (const catId of order) {
    const cat = byCat[catId];
    if (!cat) continue;
    const all = [...cat.available, ...cat.completed].filter((a) => !a.hidden);
    if (!all.length) continue;

    const section = document.createElement('section');
    section.className = 'achievement-category';
    section.innerHTML = `<h3>${ACHIEVEMENT_CATEGORY_LABELS[catId] || catId}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'quest-list';

    for (const ach of all) {
      const done = isAchievementCompleted(game.state, ach.id);
      const ready = !done && isAchievementReady(ach, game.state, game.recipes);
      const row = document.createElement('div');
      row.className = `quest-row${ready ? ' quest-ready' : ''}${done ? ' quest-done' : ''}`;
      const bonus = ach.rewardBonus || ach.permanentBonus;
      const bonusTxt = bonus
        ? ` · Bonus : ${bonus.kirha ? `+${(bonus.kirha * 100).toFixed(0)}% 💰 ` : ''}${bonus.xp ? `+${(bonus.xp * 100).toFixed(0)}% XP ` : ''}${bonus.harvestSpeed ? `+${(bonus.harvestSpeed * 100).toFixed(0)}% vitesse` : ''}`
        : '';
      row.innerHTML = `
        <div class="quest-row-head">
          <strong>${ach.title}</strong>
          <span class="quest-status">${getAchievementStatusText(ach, game.state, game.recipes)}</span>
        </div>
        <p class="quest-desc">${ach.description}${bonusTxt}</p>
      `;
      if (ach.hintView && ready) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'btn btn-small btn-muted quest-go';
        go.textContent = 'Y aller';
        go.addEventListener('click', () => navigate(ach.hintView === 'workshop' ? 'workshop' : ach.hintView));
        row.appendChild(go);
      }
      grid.appendChild(row);
    }
    section.appendChild(grid);
    list.appendChild(section);
  }

  if (!list.children.length) {
    list.innerHTML = '<p class="empty-text">Aucun succès disponible pour le moment.</p>';
  }
}

function renderMissions(game, el) {
  renderAchievements(game, el);
}

/* ── Monde ── */
function renderWorld(game, el) {
  const s = game.state;
  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('world'), 'view-header-icon', 'Monde')} Monde</h2>
      <p class="view-desc">Voyage entre les zones pour accéder aux ressources</p>
    </div>
    <div id="world-list"></div>
  `;
  const list = el.querySelector('#world-list');

  for (const zone of Object.values(game.balance.zones)) {
    const unlocked = game.isZoneUnlocked(zone.id);
    const here = s.zone === zone.id;
    const zoneResources = Object.values(game.resources)
      .filter((r) => r.zone === zone.id && !r.craftOnly && !r.combatOnly);

    const card = document.createElement('div');
    card.className = `world-card${here ? ' active' : ''}${!unlocked ? ' locked' : ''}`;

    let action = '';
    if (here) {
      action = '<span class="world-here">📍 Tu es ici</span>';
    } else if (unlocked) {
      action = '<button class="btn btn-travel">Voyager</button>';
    } else {
      const check = game.canUnlockZone(zone.id);
      const hint = game.getZoneUnlockHint(zone.id);
      const reqLines = game.getZoneUnlockRequirementsList(zone.id);
      const reqHtml = reqLines.length
        ? `<ul class="world-unlock-reqs">${reqLines.map((l) => `<li>${l}</li>`).join('')}</ul>`
        : '';
      const kirhaCost = zone.unlockRequirements?.kirha ?? zone.unlockCost ?? 0;
      action = `
        <button class="btn btn-unlock" ${check.ok ? '' : 'disabled'}>Débloquer · ${formatNumber(kirhaCost)} 💰</button>
        ${reqHtml}
        ${hint ? `<p class="world-unlock-hint">${hint}</p>` : ''}
        ${!check.ok && check.reason && check.reason !== hint ? `<p class="world-unlock-hint">${check.reason}</p>` : ''}
      `;
    }

    const chips = zoneResources
      .slice()
      .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1))
      .map((r) => {
        const job = game.jobs[r.job];
        const unlocked = isResourceUnlockedByJob(r, game.state);
        const lvl = r.requiredJobLevel || 1;
        const title = unlocked
          ? `${r.name} · ${job?.name || ''} (débloqué)`
          : `${r.name} · ${job?.name || ''} Nv.${lvl}`;
        return `<span class="world-res-chip${unlocked ? '' : ' locked'}" title="${title}">
          ${renderResourceIcon(r, 'world-res-icon')}
          <span class="world-res-chip-name">${r.name}</span>
          ${unlocked ? '' : `<span class="world-res-chip-lvl">Nv.${lvl}</span>`}
        </span>`;
      }).join('');

    card.innerHTML = `
      <div class="world-card-head">
        <div>
          <span class="world-name">${zone.emoji} ${zone.name}</span>
          ${zone.description ? `<p class="world-desc">${zone.description}</p>` : ''}
        </div>
        ${action}
      </div>
      <div class="world-res-icons">${chips || '<span class="world-res-chip">—</span>'}</div>
    `;

    card.querySelector('.btn-travel')?.addEventListener('click', () => game.travelToZone(zone.id));
    card.querySelector('.btn-unlock')?.addEventListener('click', () => game.unlockZone(zone.id));
    list.appendChild(card);
  }
}

/* ── Métiers (emplacements récolte) ── */
function getPickerChipVisual(res, selectedId, slot) {
  const isSelected = res.id === selectedId;
  const phase = isSelected && slot?.active ? slot.active.phase : null;
  const visState = phase === 'regrowing' ? 'regrowing' : phase === 'harvesting' ? 'harvesting' : 'available';
  const vis = getResourceVisual(res, visState);
  const invIcon = getResourceIcon(res);
  const icon = invIcon
    ? iconHtml(invIcon, 'pick-sprite', res.name)
    : `<span class="pick-emoji">${vis.emoji || ''}</span>`;
  return {
    icon,
    name: res.name,
    stateClass: phase ? ` state-${visState}` : '',
  };
}

function getPickerOptions(picker) {
  const optionsId = picker.querySelector('.picker-toggle')?.getAttribute('aria-controls');
  return optionsId ? document.getElementById(optionsId) : picker.querySelector('.picker-options');
}

function portalPickerOptions(picker) {
  const options = getPickerOptions(picker);
  const portal = document.getElementById('picker-sheet-portal');
  if (!options || !portal || options.parentElement === portal) return;

  const anchor = document.createElement('span');
  anchor.className = 'picker-options-anchor';
  anchor.hidden = true;
  options.before(anchor);
  picker._optionsAnchor = anchor;
  portal.appendChild(options);
}

function restorePickerOptions(picker) {
  const options = getPickerOptions(picker);
  if (!options) return;

  const portal = document.getElementById('picker-sheet-portal');
  if (portal && options.parentElement === portal) {
    const anchor = picker._optionsAnchor;
    if (anchor?.isConnected) {
      anchor.after(options);
      anchor.remove();
    } else {
      picker.appendChild(options);
    }
    delete picker._optionsAnchor;
  }
}

function forceClosePickerSheet() {
  document.getElementById('picker-sheet-backdrop')?.classList.remove('active');
  document.body.classList.remove('picker-sheet-open');
}

function cleanupOrphanedPickerOptions() {
  const portal = document.getElementById('picker-sheet-portal');
  if (!portal) return;
  portal.querySelectorAll('.picker-options').forEach((options) => {
    const toggle = document.querySelector(`[aria-controls="${options.id}"]`);
    const picker = toggle?.closest('.resource-picker');
    if (picker) restorePickerOptions(picker);
    else options.remove();
  });
}

export function closeAllResourcePickers() {
  document.querySelectorAll('.resource-picker.picker-open').forEach(collapseResourcePicker);
  cleanupOrphanedPickerOptions();
  forceClosePickerSheet();
}

function ensurePickerSheetBackdrop() {
  const backdrop = document.getElementById('picker-sheet-backdrop');
  if (!backdrop) return null;
  if (!backdrop.dataset.bound) {
    backdrop.dataset.bound = '1';
    backdrop.addEventListener('click', () => {
      document.querySelectorAll('.resource-picker.picker-open').forEach(collapseResourcePicker);
    });
  }
  return backdrop;
}

function openResourcePicker(picker) {
  document.querySelectorAll('.resource-picker.picker-open').forEach((el) => {
    if (el !== picker) collapseResourcePicker(el);
  });
  picker.classList.add('picker-open');
  picker.querySelector('.picker-toggle')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('picker-sheet-open');
  ensurePickerSheetBackdrop()?.classList.add('active');
  portalPickerOptions(picker);
}

function syncPickerToggle(picker, selectedId, assignable, slot, progress = 0) {
  const toggle = picker.querySelector('.picker-toggle');
  if (!toggle) return;

  const selected = selectedId ? assignable.find((r) => r.id === selectedId) : null;
  const chip = selected
    ? getPickerChipVisual(selected, selectedId, slot)
    : { icon: '<span class="pick-emoji">⬜</span>', name: 'Choisir' };

  const iconWrap = toggle.querySelector('.pick-icon-wrap');
  const nameEl = toggle.querySelector('.picker-toggle-name');
  if (iconWrap) iconWrap.innerHTML = chip.icon;
  if (nameEl) {
    nameEl.textContent = chip.name;
    nameEl.title = chip.name;
  }
}

function collapseResourcePicker(picker) {
  restorePickerOptions(picker);
  picker.classList.remove('picker-open');
  picker.querySelector('.picker-toggle')?.setAttribute('aria-expanded', 'false');
  if (!document.querySelector('.resource-picker.picker-open')) {
    cleanupOrphanedPickerOptions();
    forceClosePickerSheet();
  }
}

function buildResourcePicker(game, jobId, slotIndex, assignable, selectedId, slot) {
  const active = !!slot?.active;
  const progress = active ? game.getSlotHarvestProgress(jobId, slotIndex) : 0;
  const picker = document.createElement('div');
  picker.className = `resource-picker picker-slot picker-collapsible${active ? ' picker-locked' : ''}`;

  const selected = selectedId ? assignable.find((r) => r.id === selectedId) : null;
  const toggleChip = selected
    ? getPickerChipVisual(selected, selectedId, slot)
    : { icon: '<span class="pick-emoji">⬜</span>', name: 'Choisir' };

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'picker-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', `picker-options-${jobId}-${slotIndex}`);
  toggle.innerHTML = `
    <span class="pick-icon-wrap">${toggleChip.icon}</span>
    <span class="picker-toggle-text">
      <span class="picker-toggle-name" title="${toggleChip.name}">${toggleChip.name}</span>
    </span>
    <span class="picker-chevron" aria-hidden="true">▼</span>
  `;
  if (!active) {
    toggle.addEventListener('click', () => {
      if (picker.classList.contains('picker-open')) {
        collapseResourcePicker(picker);
      } else {
        openResourcePicker(picker);
      }
    });
  }
  picker.appendChild(toggle);

  const options = document.createElement('div');
  options.className = 'picker-options';
  options.id = `picker-options-${jobId}-${slotIndex}`;

  const sheetHeader = document.createElement('div');
  sheetHeader.className = 'picker-sheet-header';
  sheetHeader.innerHTML = `
    <span class="picker-sheet-title">Choisir une ressource</span>
    <button type="button" class="picker-sheet-close" aria-label="Fermer">✕</button>
  `;
  sheetHeader.querySelector('.picker-sheet-close').addEventListener('click', (e) => {
    e.stopPropagation();
    collapseResourcePicker(picker);
  });
  options.appendChild(sheetHeader);

  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = `resource-pick-btn resource-pick-none${!selectedId ? ' selected' : ''}`;
  noneBtn.title = 'Aucune ressource';
  noneBtn.setAttribute('aria-label', 'Aucune ressource');
  noneBtn.innerHTML = `
    <span class="pick-icon-wrap"><span class="pick-emoji">⬜</span></span>
    <span class="pick-name">Aucune ressource</span>
    <span class="pick-check" aria-hidden="true">${!selectedId ? '✓' : ''}</span>
  `;
  if (!active) {
    noneBtn.addEventListener('click', () => {
      collapseResourcePicker(picker);
      if (selectedId) game.clearSlot(jobId, slotIndex);
    });
  }
  options.appendChild(noneBtn);

  for (const res of assignable) {
    const chip = getPickerChipVisual(res, selectedId, slot);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `resource-pick-btn${res.id === selectedId ? ' selected' : ''}${chip.stateClass}`;
    btn.title = res.name;
    btn.setAttribute('aria-label', res.name);
    const isSelected = res.id === selectedId;
    btn.innerHTML = `
      <span class="pick-icon-wrap">${chip.icon}</span>
      <span class="pick-name">${chip.name}</span>
      <span class="pick-check" aria-hidden="true">${isSelected ? '✓' : ''}</span>
    `;
    if (!active) {
      btn.addEventListener('click', () => {
        collapseResourcePicker(picker);
        if (res.id === selectedId) return;
        game.assignResourceToSlot(jobId, slotIndex, res.id);
      });
    }
    options.appendChild(btn);
  }

  picker.appendChild(options);
  return picker;
}

function getHarvestBtnLabel(phase, progress = 0) {
  const pct = Math.floor(progress * 100);
  if (phase === 'harvesting') return `Récolte ${pct}%`;
  if (phase === 'regrowing') return `Repousse ${pct}%`;
  return 'Récolter';
}

function createHarvestSlotCard(game, jobId, slotIndex) {
  const slot = game.state.harvestSlots?.[jobId]?.[slotIndex];
  const assignable = game.getAssignableResources(jobId).filter((r) =>
    isResourceUnlockedByJob(r, game.state)
  );
  const active = !!slot?.active;
  const progress = active ? game.getSlotHarvestProgress(jobId, slotIndex) : 0;
  const selectedId = slot?.resourceId;
  const selected = selectedId ? game.resources[selectedId] : null;
  const display = getSlotVisualDisplay(selected, slot, progress);

  const phase = slot?.active?.phase;
  const toolBlock = !active && selectedId
    ? game.getHarvestToolBlockReason(jobId, selectedId)
    : null;
  const canHarvest = !active && selectedId && !toolBlock;
  const btnLabel = canHarvest ? 'Récolter !' : getHarvestBtnLabel(phase, progress);
  const harvestHint = !active && selectedId
    ? (game.getHarvestSlotHint?.(jobId, selectedId) || toolBlock)
    : null;
  const harvestXp = selected && !active ? getHarvestXp(selected, game.state, game.balance) : 0;

  const card = document.createElement('div');
  card.className = `harvest-slot state-${display.visualState}${active ? ' active-harvest' : ''}${canHarvest ? ' slot-can-harvest' : ''}`;
  card.dataset.job = jobId;
  card.dataset.slot = String(slotIndex);
  card.dataset.visualState = display.visualState;

  const spriteHtml = display.sprite
    ? `<img class="slot-visual-sprite" src="${display.sprite}" alt="" />`
    : `<span class="slot-visual-emoji" aria-hidden="true">${display.emoji || '⬜'}</span>`;

  card.innerHTML = `
    <div class="slot-visual" data-state="${display.visualState}">
      ${canHarvest ? '<span class="slot-ready-badge">Prêt</span>' : ''}
      ${spriteHtml}
    </div>
    <div class="slot-footer">
      <div class="slot-picker-mount"></div>
      ${harvestHint ? `<p class="slot-tool-hint">${harvestHint}</p>` : ''}
      ${harvestXp > 0 && !active ? `<p class="slot-xp-hint">+${harvestXp} XP ${game.jobs[jobId]?.name || ''}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}${!active && selectedId && !toolBlock ? ' affordable' : ''}" ${active || !selectedId || toolBlock ? 'disabled' : ''} title="${harvestHint || 'Récolter'}">
        ${btnLabel}
      </button>
    </div>
  `;

  card.querySelector('.slot-picker-mount').appendChild(
    buildResourcePicker(game, jobId, slotIndex, assignable, selectedId, slot)
  );

  card.querySelector('.btn-start')?.addEventListener('click', () => {
    if (!active && selectedId) game.startSlotHarvest(jobId, slotIndex);
  });

  return card;
}

function mountSlotCard(container, card, slotIndex, slotSelector) {
  const existing = container.querySelector(slotSelector);
  if (existing) {
    existing.replaceWith(card);
    return;
  }
  const next = container.querySelector(`.harvest-slot[data-slot="${slotIndex + 1}"]`)
    || container.querySelector('.slot-locked');
  if (next) container.insertBefore(card, next);
  else container.appendChild(card);
}

function renderHarvestSlot(game, jobId, slotIndex, container) {
  const card = createHarvestSlotCard(game, jobId, slotIndex);
  mountSlotCard(
    container,
    card,
    slotIndex,
    `.harvest-slot[data-job="${jobId}"][data-slot="${slotIndex}"]`
  );
}

export function patchHarvestSlot(game, jobId, unitIndex, resourceId) {
  const viewJobId = VIEWS[getView()]?.job;
  if (!viewJobId || viewJobId !== jobId) return;
  const container = document.getElementById('view-container');
  if (!container) return;
  renderJobProduction(game, container, jobId);
}

/** Animation ponctuelle quand une unité redevient récoltable après repousse. */
export function flashHarvestSlotReady(jobId, unitIndex, resourceId) {
  requestAnimationFrame(() => {
    const selector = resourceId
      ? `.production-unit[data-job="${jobId}"][data-resource="${resourceId}"][data-unit="${unitIndex}"]`
      : `.harvest-slot[data-job="${jobId}"][data-slot="${unitIndex}"]`;
    const card = document.querySelector(selector);
    if (!card) return;
    card.classList.add('slot-just-ready');
    const done = () => card.classList.remove('slot-just-ready');
    card.addEventListener('animationend', done, { once: true });
    setTimeout(done, 2800);
  });
}

export function updateHarvestSlotProgresses(game) {
  const viewJobId = VIEWS[getView()]?.job;
  if (!viewJobId) return;
  updateProductionLineProgresses(game, viewJobId);
}

function renderLockedHarvestSlot(game, jobId, slotIndex, container, showBuy) {
  const preview = game.getSlotUnlockPreview(jobId);
  const kirhaCost = preview.kirha ?? 0;
  const canBuy = showBuy && game.canBuyHarvestSlot(jobId);

  let resCostHtml = '';
  if (preview.resources) {
    const parts = Object.entries(preview.resources).map(([resId, amt]) => {
      const res = game.resources[resId];
      const have = game.state.inventory[resId] || 0;
      const cls = have >= amt ? 'ing-ok' : 'ing-missing';
      return `<span class="${cls}">${renderResourceIcon(res, 'ing-icon') || ''} ${have}/${amt}</span>`;
    });
    resCostHtml = `<div class="slot-unlock-res">${parts.join(' ')}</div>`;
  }

  const card = document.createElement('div');
  card.className = 'harvest-slot slot-locked';
  card.innerHTML = `
    <div class="tile-name">🔒 Verrouillé</div>
    <p class="empty-text">${showBuy ? 'Débloquer un emplacement pour ce métier' : 'Achète le slot précédent'}</p>
    ${showBuy ? `
      ${resCostHtml}
      <button class="btn btn-upgrade btn-buy-slot" ${canBuy ? '' : 'disabled'}>
        Acheter · ${formatNumber(kirhaCost)} 💰
      </button>
    ` : ''}
  `;

  if (showBuy) {
    card.querySelector('.btn-buy-slot')?.addEventListener('click', () => game.buyHarvestSlot(jobId));
  }

  container.appendChild(card);
}

function buildHarvestInventoryChipsHtml(game, jobId) {
  const resources = game.getAssignableResources(jobId)
    .filter((r) => isResourceUnlockedByJob(r, game.state) || (game.state.inventory[r.id] || 0) > 0);

  return resources.map((r) => {
    const qty = game.state.inventory[r.id] || 0;
    const cls = qty > 0 ? 'harvest-inv-chip has-qty' : 'harvest-inv-chip';
    return `<span class="${cls}" title="${r.name}">${renderResourceIcon(r, 'harvest-inv-icon') || ''}<span class="harvest-inv-qty">${qty}</span></span>`;
  }).join('');
}

function buildHarvestInventoryStrip(game, jobId) {
  const chips = buildHarvestInventoryChipsHtml(game, jobId);
  if (!chips) return '';

  return `
    <div class="panel-inner harvest-inventory-strip">
      <h3>Ton stock</h3>
      <div class="harvest-inv-chips">${chips}</div>
    </div>
  `;
}

function buildJobEquippedToolsStrip(game, jobId) {
  const toolId = game.state.equipment?.jobs?.[jobId];
  const accId = game.state.equipment?.accessories?.[jobId];
  let rows = '';
  if (toolId) rows += renderEquippedToolRow(game.state, toolId, game.recipes, 'Outil');
  if (accId) rows += renderEquippedToolRow(game.state, accId, game.recipes, 'Accessoire');
  if (!rows) return '';
  return `<div class="panel-inner job-tools-strip"><h3>Outils équipés</h3>${rows}</div>`;
}

function buildBreederToolStrip(game) {
  const toolId = game.state.equipment?.jobs?.breeder;
  if (!toolId) return '';
  return `<div class="panel-inner job-tools-strip job-tools-strip-compact">${renderEquippedToolRow(game.state, toolId, game.recipes, 'Outil éleveur')}</div>`;
}

function buildFarmFeedCostHtml(game, building, feedId) {
  const cost = getFeedCost(building, feedId);
  if (!cost || !Object.keys(cost).length) return '';
  const parts = Object.entries(cost).map(([resId, amt]) => {
    const res = game.resources[resId];
    const have = game.state.inventory[resId] || 0;
    const cls = have >= amt ? 'ing-ok' : 'ing-missing';
    return `<span class="${cls}">${renderResourceIcon(res, 'ing-icon') || ''} ${have}/${amt}</span>`;
  }).join(' ');
  return `<div class="farm-feed-cost"><span class="farm-feed-cost-label">Coût par production :</span> ${parts}</div>`;
}

function buildFarmAnimalPurchaseHtml(game, animalCost) {
  const canAfford = Object.entries(animalCost).every(([resId, amt]) => {
    if (resId === 'kirha') return (game.state.kirha || 0) >= amt;
    return (game.state.inventory[resId] || 0) >= amt;
  });
  const costParts = [];
  if (animalCost.kirha) {
    const ok = (game.state.kirha || 0) >= animalCost.kirha;
    costParts.push(`<span class="${ok ? 'ing-ok' : 'ing-missing'}">${animalCost.kirha} 💰</span>`);
  }
  for (const [resId, amt] of Object.entries(animalCost)) {
    if (resId === 'kirha') continue;
    const res = game.resources[resId];
    const have = game.state.inventory[resId] || 0;
    const cls = have >= amt ? 'ing-ok' : 'ing-missing';
    costParts.push(`<span class="${cls}">${renderResourceIcon(res, 'ing-icon') || ''} ${have}/${amt}</span>`);
  }
  return `
    <div class="farm-animal-purchase">
      <div class="farm-animal-head">🐔 Poule requise</div>
      <div class="farm-animal-cost">${costParts.join(' ')}</div>
      <button type="button" class="btn btn-small btn-buy-animal${canAfford ? ' affordable' : ''}">Acheter une poule</button>
    </div>`;
}

function buildFarmFeedPickerHtml(game, building, slot, active) {
  const allFeeds = listFeedOptions(building);
  if (!allFeeds.length) return { pickerHtml: '', canAffordSelected: true };

  const primary = getPrimaryFeedId(building);
  const selected = slot?.feedId || primary || '';
  const single = allFeeds.length === 1;

  if (single) {
    const feedId = primary;
    const res = game.resources[feedId];
    const affordable = canAffordFeed(building, feedId, game.state);
    return {
      pickerHtml: `
        <div class="farm-feed-label">
          <span class="farm-feed-label-text">Ration · ${res?.name || feedId}</span>
          ${buildFarmFeedCostHtml(game, building, feedId)}
          ${affordable ? '' : '<p class="farm-feed-hint empty-text">Stock insuffisant</p>'}
        </div>`,
      canAffordSelected: affordable,
      autoFeedId: feedId,
    };
  }

  const options = allFeeds.map((feedId) => {
    const res = game.resources[feedId];
    const affordable = canAffordFeed(building, feedId, game.state);
    const stockNote = affordable ? '' : ' · stock insuffisant';
    const label = `${res?.name || feedId}${stockNote}`;
    const disabled = !affordable && feedId !== selected ? ' disabled' : '';
    return `<option value="${feedId}"${feedId === selected ? ' selected' : ''}${disabled}>${label}</option>`;
  }).join('');

  const costHtml = selected
    ? buildFarmFeedCostHtml(game, building, selected)
    : '<p class="farm-feed-hint empty-text">Choisis une ration pour voir le coût</p>';

  return {
    pickerHtml: `
      <label class="farm-feed-label">
        <span class="farm-feed-label-text">Ration</span>
        <select class="farm-feed-select"${active ? ' disabled' : ''}>
          ${options}
        </select>
      </label>
      ${costHtml}`,
    canAffordSelected: !selected || canAffordFeed(building, selected, game.state),
    autoFeedId: selected || null,
  };
}

export function isResourcePickerOpen() {
  return !!document.querySelector('.resource-picker.picker-open');
}

export function updateHarvestInventoryStrip(game, jobId) {
  const strip = document.querySelector('.harvest-inventory-strip .harvest-inv-chips');
  if (!strip) return;
  strip.innerHTML = buildHarvestInventoryChipsHtml(game, jobId);
}

/** Mise à jour partielle sans fermer le sélecteur de ressource ouvert. */
export function refreshJobViewLight(game, jobId) {
  const prog = game.getJobProgress(jobId);
  const pct = (prog.xp / prog.needed) * 100;
  const bar = document.querySelector('.skill-header .xp-bar');
  const text = document.querySelector('.skill-header .xp-text');
  const meta = document.querySelector('.skill-header-meta');
  if (bar) bar.style.width = `${pct}%`;
  if (text) {
    text.textContent = prog.atSeasonCap
      ? `Plafond Saison ${game.state.season || 1} — passe à la suivante`
      : `${prog.xp} / ${prog.needed} XP`;
  }
  if (meta) {
    meta.textContent = `Niveau ${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}`;
  }
  updateHarvestInventoryStrip(game, jobId);
  const toolsStrip = document.querySelector('.panel-inner.job-tools-strip');
  if (toolsStrip) {
    const fresh = buildJobEquippedToolsStrip(game, jobId);
    if (fresh) toolsStrip.outerHTML = fresh;
    else toolsStrip.remove();
  }
  updateHarvestSlotProgresses(game);
}

function renderJob(game, el, jobId) {
  if (!isGatheringJobUnlocked(jobId, game.state, game.balance)) {
    const progress = getGatheringJobUnlockProgress(jobId, game.state, game.balance, game.jobs);
    if (progress) {
      renderLockedUnlockPanel(game, el, {
        ...progress,
        label: game.jobs[jobId]?.name || jobId,
        emoji: game.jobs[jobId]?.emoji || '🔒',
        viewId: `job_${jobId}`,
      });
      return;
    }
  }
  renderJobProduction(game, el, jobId);
}

function renderJobLegacyUnused(game, el, jobId) {
  const job = game.jobs[jobId];
  const prog = game.getJobProgress(jobId);
  const zone = game.getCurrentZone();
  const pct = (prog.xp / prog.needed) * 100;
  const maxSlots = game.balance.harvestSlots.maxSlots;
  const ownedSlots = game.getMaxHarvestSlots(jobId);
  const assignable = game.getAssignableResources(jobId);
  const lockedResources = assignable
    .filter((r) => !isResourceUnlockedByJob(r, game.state))
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1));
  const nextUnlock = lockedResources[0] || null;
  const currentView = getHarvestViewForJob(jobId);
  const visibleHarvestViews = getVisibleHarvestViews(game.state);
  const prevView = currentView ? getAdjacentVisibleView(currentView, visibleHarvestViews, -1) : null;
  const nextView = currentView ? getAdjacentVisibleView(currentView, visibleHarvestViews, 1) : null;
  const prevJob = prevView ? VIEWS[prevView]?.job : null;
  const nextJob = nextView ? VIEWS[nextView]?.job : null;

  const nextUnlockHtml = nextUnlock ? `
    <button type="button" class="job-next-unlock" id="job-next-unlock" title="Ressources à débloquer">
      ${renderResourceIcon(nextUnlock, 'job-next-unlock-icon')}
      <span class="job-next-unlock-text">
        <span class="job-next-unlock-label">Prochaine</span>
        <span class="job-next-unlock-name">${nextUnlock.name}</span>
        <span class="job-next-unlock-lvl">Nv.${nextUnlock.requiredJobLevel || 1}</span>
      </span>
    </button>
  ` : '';

  el.innerHTML = `
    <div class="skill-header skill-header-compact">
      <div class="skill-header-top job-nav-header">
        <button type="button" class="btn btn-muted btn-job-nav" id="job-prev" aria-label="Métier précédent" ${prevView ? '' : 'disabled'}>‹</button>
        <div class="job-nav-center">
          <div class="skill-header-title">${getJobIcon(jobId) ? iconHtml(getJobIcon(jobId), 'job-icon', job.name) : ''} ${job.name}
            <span class="skill-level-pill">Nv.${prog.level}${prog.seasonCap ? `/${prog.seasonCap}` : ''}</span>
          </div>
          <div class="skill-header-meta">${zone?.name || ''}</div>
        </div>
        <button type="button" class="btn btn-muted btn-job-nav" id="job-next" aria-label="Métier suivant" ${nextView ? '' : 'disabled'}>›</button>
      </div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.atSeasonCap ? `Plafond Saison ${game.state.season || 1}` : `${prog.xp} / ${prog.needed} XP`}</p>
    </div>
    <div class="panel-inner job-harvest-panel">
      <div class="panel-head-row">
        <h3>Récolte</h3>
        <div class="job-harvest-actions">
          ${nextUnlockHtml}
          <button class="btn btn-muted btn-small" id="goto-world" type="button">Zone</button>
        </div>
      </div>
      <div class="slots-grid" id="harvest-slots"></div>
    </div>
    ${buildJobEquippedToolsStrip(game, jobId)}
    ${buildHarvestInventoryStrip(game, jobId)}
    ${lockedResources.length > 1 ? `
      <details class="panel-inner panel-muted job-locked-details">
        <summary>Autres ressources · ${lockedResources.length - 1} verrouillées</summary>
        <div class="resource-grid job-locked-grid" id="locked-resources"></div>
      </details>
    ` : lockedResources.length === 1 ? '' : ''}
    <div class="job-nav-footer">
      <div class="job-nav-hints">
        ${prevJob ? `<span class="job-nav-hint">${game.jobs[prevJob]?.name || ''}</span>` : '<span></span>'}
        ${nextJob ? `<span class="job-nav-hint">${game.jobs[nextJob]?.name || ''}</span>` : '<span></span>'}
      </div>
      <div class="job-nav-mobile">
        <button type="button" class="btn btn-muted btn-nav-mobile" id="job-prev-mobile" ${prevView ? '' : 'disabled'}>‹ ${prevJob ? game.jobs[prevJob]?.name : 'Préc.'}</button>
        <button type="button" class="btn btn-muted btn-nav-mobile" id="job-next-mobile" ${nextView ? '' : 'disabled'}>${nextJob ? game.jobs[nextJob]?.name : 'Suiv.'} ›</button>
      </div>
    </div>
  `;

  el.querySelector('#goto-world')?.addEventListener('click', () => navigate('world'));
  el.querySelector('#job-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#job-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });
  el.querySelector('#job-prev-mobile')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#job-next-mobile')?.addEventListener('click', () => { if (nextView) navigate(nextView); });
  el.querySelector('#job-next-unlock')?.addEventListener('click', () => {
    const details = el.querySelector('.job-locked-details');
    if (details) details.open = true;
    details?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  const slotsEl = el.querySelector('#harvest-slots');
  for (let i = 0; i < maxSlots; i++) {
    if (i < ownedSlots) {
      renderHarvestSlot(game, jobId, i, slotsEl);
    } else {
      renderLockedHarvestSlot(game, jobId, i, slotsEl, i === ownedSlots);
    }
  }

  const lockedEl = el.querySelector('#locked-resources');
  if (lockedEl) {
    for (const resource of lockedResources.slice(1)) {
      const tile = document.createElement('div');
      tile.className = 'resource-tile locked-res locked-res-compact';
      tile.innerHTML = `
        <div class="tile-head">
          ${renderResourceIcon(resource, 'tile-resource-icon')}
          <div>
            <div class="tile-name">${resource.name}</div>
            <div class="tile-lock">Nv.${resource.requiredJobLevel || 1}</div>
          </div>
        </div>
      `;
      lockedEl.appendChild(tile);
    }
  }
}

function getFarmBtnLabel(progress) {
  if (progress <= 0) return 'Produire';
  if (progress >= 1) return 'Collecter';
  return `Production ${getFarmProgressPct(progress)}%`;
}

/** Pourcentage affiché (1–99 en cours, 100 à la fin). */
function getFarmProgressPct(progress) {
  if (progress >= 1) return 100;
  return Math.max(1, Math.min(99, Math.floor(progress * 100)));
}

function updateFarmSlotCardProgress(card, progress) {
  const pct = getFarmProgressPct(progress);
  const bar = card.querySelector('.slot-progress .xp-bar');
  if (bar) bar.style.width = `${pct}%`;
  const btn = card.querySelector('.btn-start');
  if (btn) {
    btn.textContent = getFarmBtnLabel(progress);
    btn.classList.add('harvesting-btn');
    btn.disabled = progress < 1;
    btn.classList.toggle('affordable', progress >= 1);
  }
  const visual = card.querySelector('.slot-visual');
  if (visual) visual.dataset.state = progress >= 1 ? 'ready' : 'harvesting';
}

function getFarmBuildingSprite(building) {
  const icon = getFarmBuildingIcon(building.id);
  if (icon) return icon;
  return null;
}

function buildFarmProductStrip(game, building) {
  const productIds = Object.keys(building.products || {});
  if (!productIds.length) return '';

  const chips = productIds.map((resId) => {
    const res = game.resources[resId];
    const qty = game.state.inventory[resId] || 0;
    const icon = getFarmProductIcon(resId) || getResourceIcon(res);
    const iconHtmlStr = icon
      ? iconHtml(icon, 'harvest-inv-icon', res?.name || resId)
      : (renderResourceIcon(res, 'harvest-inv-icon') || '');
    return `<span class="harvest-inv-chip${qty > 0 ? ' has-qty' : ''}" title="${res?.name || resId}">${iconHtmlStr}<span class="harvest-inv-qty">${qty}</span></span>`;
  }).join('');

  return `
    <div class="panel-inner harvest-inventory-strip">
      <h3>Productions</h3>
      <div class="harvest-inv-chips">${chips}</div>
    </div>
  `;
}


function renderFarmSlot(game, buildingId, slotIndex, building, container) {
  const slot = game.state.farmSlots?.[buildingId]?.[slotIndex];
  const active = !!slot?.active;
  const progress = active ? game.getFarmSlotProgress(buildingId, slotIndex) : 0;
  const needsFeed = Object.keys(building.feed || {}).length > 0;
  const feedUi = needsFeed ? buildFarmFeedPickerHtml(game, building, slot, active) : { pickerHtml: '', canAffordSelected: true };

  // Auto-sélection de la ration unique (ex. 2 blé au poulailler).
  if (!active && needsFeed && feedUi.autoFeedId && slot && slot.feedId !== feedUi.autoFeedId) {
    slot.feedId = feedUi.autoFeedId;
  }

  const toolBlock = game.getFarmToolBlockReason(buildingId);
  const sprite = getFarmBuildingSprite(building);
  const effectiveFeedId = slot?.feedId || feedUi.autoFeedId;
  const feedBlocked = needsFeed && (!effectiveFeedId || !feedUi.canAffordSelected);

  const card = document.createElement('div');
  card.className = `farm-slot harvest-slot${active ? ' active-harvest' : ''}`;
  card.dataset.building = buildingId;
  card.dataset.slot = String(slotIndex);

  const spriteHtml = sprite
    ? `<img class="slot-visual-sprite" src="${sprite}" alt="" />`
    : `<span class="slot-visual-emoji" aria-hidden="true">${building.emoji || '🏠'}</span>`;

  const needsAnimal = building.requiresAnimal && !slot?.hasAnimal;
  const animalCost = building.animalPurchase;
  let animalHtml = '';
  if (needsAnimal && animalCost && !active) {
    animalHtml = buildFarmAnimalPurchaseHtml(game, animalCost);
  }

  const produceBlocked = needsAnimal || feedBlocked || toolBlock;

  card.innerHTML = `
    <div class="slot-visual" data-state="${active ? 'harvesting' : 'available'}">
      ${spriteHtml}
    </div>
    <div class="slot-footer">
      ${animalHtml}
      ${needsFeed ? feedUi.pickerHtml : ''}
      ${active ? `<div class="xp-bar-container slot-progress"><div class="xp-bar" style="width:${getFarmProgressPct(progress)}%"></div></div>` : ''}
      ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}${!active && !produceBlocked ? ' affordable' : ''}${active && progress >= 1 ? ' affordable' : ''}" ${active && progress < 1 || (!active && produceBlocked) ? 'disabled' : ''}>
        ${getFarmBtnLabel(progress)}
      </button>
    </div>
  `;

  if (!active) {
    card.querySelector('.btn-buy-animal')?.addEventListener('click', () => {
      const result = game.buyFarmAnimal(buildingId, slotIndex);
      if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
      else renderFarmSlot(game, buildingId, slotIndex, building, container);
    });
    card.querySelector('.farm-feed-select')?.addEventListener('change', (e) => {
      const feedId = e.target.value;
      if (!feedId) return;
      game.setFarmFeed(buildingId, slotIndex, feedId);
      renderFarmSlot(game, buildingId, slotIndex, building, container);
    });
    card.querySelector('.btn-start')?.addEventListener('click', () => {
      const result = game.startFarmSlot(buildingId, slotIndex);
      if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
    });
  } else if (progress >= 1) {
    card.querySelector('.btn-start')?.addEventListener('click', () => {
      game.completeFarmSlot(buildingId, slotIndex);
      patchFarmSlot(game, buildingId, slotIndex);
    });
  }

  const existing = container.querySelector(`.farm-slot[data-building="${buildingId}"][data-slot="${slotIndex}"]`);
  if (existing) {
    existing.replaceWith(card);
  } else {
    const next = container.querySelector(`.farm-slot[data-slot="${slotIndex + 1}"]`)
      || container.querySelector('.farm-slot-locked');
    if (next) container.insertBefore(card, next);
    else container.appendChild(card);
  }
}

function renderLockedFarmSlot(game, buildingId, slotIndex, container, showBuy) {
  const preview = game.getFarmSlotUnlockPreview(buildingId);
  const kirhaCost = preview.kirha ?? 0;
  const canBuy = showBuy && game.canBuyFarmSlot(buildingId);
  const building = getBuildingDef(game.farmData, buildingId);

  let resCostHtml = '';
  if (preview.resources) {
    const parts = Object.entries(preview.resources).map(([resId, amt]) => {
      const res = game.resources[resId];
      const have = game.state.inventory[resId] || 0;
      const cls = have >= amt ? 'ing-ok' : 'ing-missing';
      return `<span class="${cls}">${renderResourceIcon(res, 'ing-icon') || ''} ${have}/${amt}</span>`;
    });
    resCostHtml = `<div class="slot-unlock-res">${parts.join(' ')}</div>`;
  }

  const card = document.createElement('div');
  card.className = 'harvest-slot slot-locked farm-slot-locked';
  card.innerHTML = `
    <div class="tile-name">🔒 Emplacement animal</div>
    <p class="empty-text">${showBuy ? `Agrandir le ${building?.name || 'bâtiment'}` : 'Achète l\'emplacement précédent'}</p>
    ${showBuy ? `
      ${resCostHtml}
      <button class="btn btn-upgrade btn-buy-farm-slot" data-building="${buildingId}" ${canBuy ? '' : 'disabled'}>
        Acheter · ${formatNumber(kirhaCost)} 💰
      </button>
    ` : ''}
  `;

  if (showBuy) {
    card.querySelector('.btn-buy-farm-slot')?.addEventListener('click', () => game.buyFarmSlot(buildingId));
  }

  container.appendChild(card);
}

/** Re-rendu léger de tous les emplacements du bâtiment ferme affiché. */
export function patchFarmBuildingSlots(game, buildingId) {
  const view = getView();
  if (!isFarmView(view) || getFarmViewForBuilding(buildingId) !== view) return;
  const building = getBuildingDef(game.farmData, buildingId);
  const container = document.querySelector('#farm-slots');
  if (!building || !container) return;
  const max = game.getMaxFarmSlots(buildingId);
  for (let i = 0; i < max; i++) {
    patchFarmSlot(game, buildingId, i);
  }
}

/** Rafraîchit l'onglet Outils du Perso si ouvert (durabilité après production). */
export function refreshCharToolsIfVisible(game) {
  if (getView() !== 'character' || charTab !== 'tools') return;
  const panel = document.querySelector('#char-tab-panel');
  if (panel) renderCharToolsTab(game, panel);
}

/** Re-rendu léger d'un emplacement ferme (après collecte ou désync UI). */
export function patchFarmSlot(game, buildingId, slotIndex) {
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;
  const view = getView();
  if (!isFarmView(view) || getFarmViewForBuilding(buildingId) !== view) return;
  const container = document.querySelector('#farm-slots');
  if (!container) return;
  renderFarmSlot(game, buildingId, slotIndex, building, container);
}

/** Répare les cartes restées en « production » alors que le slot est libre. */
export function syncStaleFarmSlots(game) {
  const view = getView();
  if (!isFarmView(view)) return;
  for (const buildingId of FARM_BUILDING_IDS) {
    if (getFarmViewForBuilding(buildingId) !== view) continue;
    const slots = game.state.farmSlots?.[buildingId] || [];
    slots.forEach((slot, slotIndex) => {
      if (slot?.active) return;
      const card = document.querySelector(`.farm-slot[data-building="${buildingId}"][data-slot="${slotIndex}"]`);
      if (card?.classList.contains('active-harvest')) {
        patchFarmSlot(game, buildingId, slotIndex);
      }
    });
  }
}

export function refreshFarmViewLight(game, buildingId) {
  const prog = game.getFarmBuildingProgress(buildingId);
  const bar = document.querySelector('.skill-header .xp-bar');
  const text = document.querySelector('.skill-header .xp-text');
  const meta = document.querySelector('.skill-header-meta');
  if (prog.grantsXp) {
    if (bar) bar.style.width = `${(prog.xp / prog.needed) * 100}%`;
    if (text) {
      text.textContent = prog.atSeasonCap
        ? `Plafond Saison ${game.state.season || 1} — passe à la suivante`
        : `${prog.xp} / ${prog.needed} XP`;
    }
    if (meta) {
      meta.textContent = `Nv.${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}`;
    }
  }
  if (buildingId) {
    const building = getBuildingDef(game.farmData, buildingId);
    const strip = document.querySelector('.harvest-inventory-strip');
    if (building && strip) strip.outerHTML = buildFarmProductStrip(game, building);
  }
  syncStaleFarmSlots(game);
  updateFarmSlotProgresses(game);
}

export function shouldPartialRefreshOnStateChange(view, game) {
  if (view === 'auction_house') return { kind: 'auction' };
  const jobId = VIEWS[view]?.job;
  const buildingId = VIEWS[view]?.building;
  if (jobId && (game.isJobHarvesting(jobId) || game.isHarvesting())) return { kind: 'job', jobId };
  if (buildingId && isFarmView(view) && game.isFarmActive()) return { kind: 'farm', buildingId };
  return null;
}

export function updateFarmSlotProgresses(game) {
  for (const buildingId of FARM_BUILDING_IDS) {
    updateFarmLineProgresses(game, buildingId);
  }
}

function renderFarmBuilding(game, el, buildingId) {
  renderFarmProduction(game, el, buildingId);
}

function renderFarmBuildingLegacyUnused(game, el, buildingId) {
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;

  const job = game.jobs.breeder;
  const prog = game.getJobProgress('breeder');
  const pct = (prog.xp / prog.needed) * 100;
  const toolBlock = game.getFarmToolBlockReason(buildingId);
  const currentView = getFarmViewForBuilding(buildingId);
  const visibleFarmViews = getVisibleFarmViews(game.state);
  const prevView = getAdjacentVisibleView(currentView, visibleFarmViews, -1);
  const nextView = getAdjacentVisibleView(currentView, visibleFarmViews, 1);
  const prevBuilding = prevView ? FARM_BUILDING_LABELS[prevView.slice(5)] : null;
  const nextBuilding = nextView ? FARM_BUILDING_LABELS[nextView.slice(5)] : null;
  const buildingIcon = getFarmBuildingIcon(buildingId);
  const maxSlots = game.farmData.maxSlotsPerBuilding || 4;
  const ownedSlots = game.getMaxFarmSlots(buildingId);

  el.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-top job-nav-header">
        <button type="button" class="btn btn-muted btn-job-nav" id="farm-prev" aria-label="Bâtiment précédent" ${prevView ? '' : 'disabled'}>‹</button>
        <div class="job-nav-center">
          <div class="skill-header-title">
            ${buildingIcon ? iconHtml(buildingIcon, 'job-icon', building.name) : (building.emoji || '')}
            ${building.name}
          </div>
          <div class="skill-header-meta">${job?.name || 'Éleveur'} Nv.${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}</div>
        </div>
        <button type="button" class="btn btn-muted btn-job-nav" id="farm-next" aria-label="Bâtiment suivant" ${nextView ? '' : 'disabled'}>›</button>
      </div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.atSeasonCap ? `Plafond Saison ${game.state.season || 1}` : `${prog.xp} / ${prog.needed} XP Éleveur`}</p>
      ${toolBlock ? `<p class="slot-tool-hint farm-tool-banner">⚠️ ${toolBlock}</p>` : ''}
    </div>
    ${buildBreederToolStrip(game)}
    ${buildFarmProductStrip(game, building)}
    <div class="panel-inner">
      <div class="panel-head-row">
        <h3>Emplacements · ${ownedSlots}/${maxSlots}</h3>
      </div>
      <div class="slots-grid farm-slots" id="farm-slots"></div>
    </div>
    <div class="job-nav-footer">
      <div class="job-nav-hints">
        ${prevBuilding ? `<span class="job-nav-hint">${prevBuilding}</span>` : '<span></span>'}
        ${nextBuilding ? `<span class="job-nav-hint">${nextBuilding}</span>` : '<span></span>'}
      </div>
      <div class="job-nav-mobile">
        <button type="button" class="btn btn-muted btn-nav-mobile" id="farm-prev-mobile" ${prevView ? '' : 'disabled'}>‹ ${prevBuilding || 'Préc.'}</button>
        <button type="button" class="btn btn-muted btn-nav-mobile" id="farm-next-mobile" ${nextView ? '' : 'disabled'}>${nextBuilding || 'Suiv.'} ›</button>
      </div>
    </div>
  `;

  el.querySelector('#farm-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#farm-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });
  el.querySelector('#farm-prev-mobile')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#farm-next-mobile')?.addEventListener('click', () => { if (nextView) navigate(nextView); });

  const slotsEl = el.querySelector('#farm-slots');
  for (let i = 0; i < maxSlots; i++) {
    if (i < ownedSlots) {
      renderFarmSlot(game, buildingId, i, building, slotsEl);
    } else {
      renderLockedFarmSlot(game, buildingId, i, slotsEl, i === ownedSlots);
    }
  }
}

/* ── Ateliers (métiers craft) ── */
function renderWorkshopHub(game, el) {
  if (!game.isCraftUnlocked()) {
    const progress = getFeatureUnlockProgress('toolmaker', game.state, game.balance, game.jobs);
    if (progress) {
      renderLockedUnlockPanel(game, el, progress);
      return;
    }
  }
  if (workshopTab === 'cook') workshopTab = 'toolmaker';
  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('workshop'), 'view-header-icon', 'Atelier')} Atelier</h2>
      <p class="view-desc">Fabrique tes outils, répare-les ou fusionne ton équipement de combat.</p>
    </div>
    <div class="workshop-tabs" id="workshop-tabs" role="tablist"></div>
    <div id="workshop-content"></div>
  `;

  const tabsEl = el.querySelector('#workshop-tabs');
  for (const craft of CRAFT_NAV) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `workshop-tab${craft.id === workshopTab ? ' active' : ''}`;
    btn.dataset.craftJob = craft.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', craft.id === workshopTab ? 'true' : 'false');
    btn.textContent = `${craft.emoji} ${craft.label}`;
    btn.addEventListener('click', () => {
      workshopTab = craft.id;
      renderWorkshopHub(game, el);
    });
    tabsEl.appendChild(btn);
  }

  mountWorkshopContent(game, el.querySelector('#workshop-content'));
}

function mountWorkshopContent(game, container) {
  if (!container) return;
  if (workshopTab === 'fusion') {
    renderFusionPanel(game, container);
    return;
  }
  mountCraftWorkshop(game, container, workshopTab);
}

function renderCuisine(game, el) {
  if (!game.isCookUnlocked()) {
    const progress = getFeatureUnlockProgress('cook', game.state, game.balance, game.jobs);
    if (progress) {
      renderLockedUnlockPanel(game, el, progress);
      return;
    }
  }
  const job = game.jobs.cook;
  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('cuisine'), 'view-header-icon', 'Cuisine')} Cuisine</h2>
      <p class="view-desc">${job?.emoji || '👨‍🍳'} ${job?.name || 'Cuisinier'} — prépare des plats pour les buffs de donjon et les festins</p>
    </div>
    <div id="cuisine-content"></div>
  `;
  mountCraftWorkshop(game, el.querySelector('#cuisine-content'), 'cook');
}

/* ── Place marchande (mobile-first) ── */
const AUCTION_GROUP_LABELS = {
  services: 'Services',
  gathering: 'Récolte',
  farm: 'Ferme',
};

function getVendorGroupId(vendorId, vendor) {
  if (vendor?.testHdv && vendorId.includes('_job_')) return 'gathering';
  if (vendor?.testHdv && vendorId.includes('_farm_')) return 'farm';
  return 'services';
}

function getAuctionVendorGroups(vendorEntries) {
  const services = [];
  const gathering = [];
  const farm = [];
  for (const entry of vendorEntries) {
    const [vendorId, vendor] = entry;
    const groupId = getVendorGroupId(vendorId, vendor);
    if (groupId === 'gathering') gathering.push(entry);
    else if (groupId === 'farm') farm.push(entry);
    else services.push(entry);
  }
  const sortByName = (a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'fr');
  gathering.sort(sortByName);
  farm.sort(sortByName);
  services.sort(sortByName);
  return [
    { id: 'services', label: AUCTION_GROUP_LABELS.services, entries: services },
    { id: 'gathering', label: AUCTION_GROUP_LABELS.gathering, entries: gathering },
    { id: 'farm', label: AUCTION_GROUP_LABELS.farm, entries: farm },
  ].filter((group) => group.entries.length > 0);
}

function pickDefaultAuctionCategory(vendorEntries, groupId = auctionGroup) {
  const groups = getAuctionVendorGroups(vendorEntries);
  const group = groups.find((g) => g.id === groupId) || groups[0];
  if (group) auctionGroup = group.id;
  return group?.entries[0]?.[0] || vendorEntries[0]?.[0] || '';
}

function getVendorsForHdvMode(game, mode = hdvMainMode) {
  const all = game.getMerchantVendors();
  if (mode === 'test') {
    return Object.fromEntries(Object.entries(all).filter(([, v]) => v.testHdv));
  }
  if (mode === 'npc') {
    return Object.fromEntries(Object.entries(all).filter(([, v]) => !v.testHdv));
  }
  return all;
}

function buildAuctionCatalog(game, mode = hdvMainMode) {
  const vendors = getVendorsForHdvMode(game, mode);
  const vendorEntries = Object.entries(vendors);
  const allOffers = [];
  for (const [vendorId, vendor] of vendorEntries) {
    for (const [offerId, offer] of Object.entries(vendor.offers || {})) {
      const resource = game.resources[offer.resourceId];
      if (!resource) continue;
      allOffers.push({ vendorId, vendor, offerId, offer, resource });
    }
  }

  const vendorGroups = getAuctionVendorGroups(vendorEntries);
  const validCategories = new Set(vendorEntries.map(([id]) => id));
  const groupIds = new Set(vendorGroups.map((g) => g.id));
  if (!groupIds.has(auctionGroup)) auctionGroup = vendorGroups[0]?.id || 'services';
  if (!auctionCategory || !validCategories.has(auctionCategory)) {
    auctionCategory = pickDefaultAuctionCategory(vendorEntries, auctionGroup);
  } else {
    const categoryGroup = getVendorGroupId(auctionCategory, vendors[auctionCategory]);
    if (categoryGroup !== auctionGroup) {
      auctionCategory = pickDefaultAuctionCategory(vendorEntries, auctionGroup);
    }
  }

  const activeGroup = vendorGroups.find((g) => g.id === auctionGroup) || vendorGroups[0];
  const activeVendor = vendors[auctionCategory];
  const visibleOffers = allOffers
    .filter(({ vendorId }) => vendorId === auctionCategory)
    .sort((a, b) => {
      const lvl = (a.resource.requiredJobLevel || 1) - (b.resource.requiredJobLevel || 1);
      if (lvl !== 0) return lvl;
      return (a.resource.name || '').localeCompare(b.resource.name || '', 'fr');
    });

  return {
    vendors,
    vendorEntries,
    vendorGroups,
    activeGroup,
    activeVendor,
    visibleOffers,
  };
}

function updateAuctionWallet(game, root) {
  root.querySelector('#hdv-wallet-kirha')?.replaceChildren(
    document.createTextNode(formatNumber(game.state.kirha || 0))
  );
  root.querySelector('#hdv-wallet-scrolls')?.replaceChildren(
    document.createTextNode(String(game.getScrollCount()))
  );
  const nuggetEl = root.querySelector('#hdv-wallet-nuggets');
  if (nuggetEl) nuggetEl.textContent = String(game.getGoldNuggetCount?.() || 0);
}

function closeAuctionSheet() {
  document.getElementById('hdv-sheet-backdrop')?.classList.remove('active');
  document.getElementById('hdv-sheet')?.classList.remove('active');
  document.body.classList.remove('hdv-sheet-open');
  document.getElementById('hdv-sheet')?.replaceChildren();
}

function ensureAuctionSheetNodes() {
  if (!document.getElementById('hdv-sheet-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'hdv-sheet-backdrop';
    backdrop.className = 'hdv-sheet-backdrop';
    backdrop.addEventListener('click', closeAuctionSheet);
    document.body.appendChild(backdrop);
  }
  if (!document.getElementById('hdv-sheet')) {
    const sheet = document.createElement('div');
    sheet.id = 'hdv-sheet';
    sheet.className = 'hdv-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    document.body.appendChild(sheet);
  }
}

function openAuctionTradeSheet(game, ctx) {
  ensureAuctionSheetNodes();
  const sheet = document.getElementById('hdv-sheet');
  const backdrop = document.getElementById('hdv-sheet-backdrop');
  const { mode, vendorId, offerId, resource, offer } = ctx;
  const quantities = offer.bulkQuantities || [1];
  const unitPrice = mode === 'sell' ? Math.floor(offer.unitPrice / 2) : offer.unitPrice;
  const ownedQty = game.state.inventory?.[offer.resourceId] || 0;
  const kirha = game.state.kirha || 0;
  const actionLabel = mode === 'sell' ? 'Vendre' : 'Acheter';

  const options = quantities.map((qty) => {
    const total = unitPrice * qty;
    const ok = mode === 'sell' ? ownedQty >= qty : kirha >= total;
    const sub = mode === 'sell'
      ? `+${formatNumber(total)} 💰`
      : ok ? `${formatNumber(total)} 💰` : `Manque ${formatNumber(total - kirha)} 💰`;
    return { qty, total, ok, sub };
  });

  sheet.innerHTML = `
    <div class="hdv-sheet-header">
      <div>
        <p class="hdv-sheet-kicker">${actionLabel}</p>
        <h3 class="hdv-sheet-title">${resource.emoji || ''} ${resource.name}</h3>
        <p class="hdv-sheet-meta">${formatNumber(unitPrice)} 💰 / unité · stock ×${ownedQty}</p>
      </div>
      <button type="button" class="hdv-sheet-close" aria-label="Fermer">✕</button>
    </div>
    <div class="hdv-sheet-options">
      ${options.map(({ qty, ok, sub }) => `
        <button type="button" class="hdv-sheet-option${ok ? ' ok' : ''}" data-qty="${qty}" ${ok ? '' : 'disabled'}>
          <span class="hdv-sheet-option-qty">×${qty}</span>
          <span class="hdv-sheet-option-price">${sub}</span>
        </button>
      `).join('')}
    </div>
  `;

  sheet.querySelector('.hdv-sheet-close')?.addEventListener('click', closeAuctionSheet);
  sheet.querySelectorAll('.hdv-sheet-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qty = Number(btn.dataset.qty) || 1;
      const result = mode === 'sell'
        ? game.sellMerchant(vendorId, offerId, qty)
        : game.buyMerchant(vendorId, offerId, qty);
      if (!result) {
        const total = unitPrice * qty;
        const msg = mode === 'sell'
          ? 'Vente impossible.'
          : kirha >= total ? 'Achat impossible.' : `Il manque ${formatNumber(total - kirha)} Kirha.`;
        emit('farmBlocked', { message: msg });
        return;
      }
      closeAuctionSheet();
    });
  });

  backdrop?.classList.add('active');
  sheet.classList.add('active');
  document.body.classList.add('hdv-sheet-open');
}

function renderAuctionOfferList(game, root) {
  const listEl = root.querySelector('#auction-offer-list');
  if (!listEl) return;

  const { visibleOffers } = buildAuctionCatalog(game, hdvMainMode);
  listEl.replaceChildren();

  if (!visibleOffers.length) {
    listEl.innerHTML = '<p class="empty-text">Aucune ressource dans cette catégorie.</p>';
    return;
  }

  for (const { vendorId, vendor, offerId, offer, resource } of visibleOffers) {
    const ownedQty = game.state.inventory?.[offer.resourceId] || 0;
    const jobLvl = resource.requiredJobLevel || 1;
    const meta = resource.farmOnly ? 'Ferme' : (resource.job ? `Nv.${jobLvl}` : '');
    const unit = offer.unitPrice;
    const canBuyOne = game.state.kirha >= unit;
    const canSellOne = offer.sellable && ownedQty >= 1;

    const row = document.createElement('article');
    row.className = `hdv-row${vendor.testHdv ? ' test' : ''}`;
    row.innerHTML = `
      <div class="hdv-row-body">
        <span class="hdv-row-icon">${renderResourceIcon(resource, 'hdv-row-icon')}</span>
        <div class="hdv-row-text">
          <div class="hdv-row-title">
            <span class="hdv-row-name">${resource.name}</span>
            ${meta ? `<span class="hdv-row-meta">${meta}</span>` : ''}
          </div>
          <span class="hdv-row-stock">Inventaire ×${ownedQty}</span>
        </div>
        <span class="hdv-row-price">${formatNumber(unit)}<small>💰/u</small></span>
      </div>
      <div class="hdv-row-actions">
        <button type="button" class="hdv-action-btn buy${canBuyOne ? ' ok' : ''}" data-action="buy">
          Acheter
        </button>
        ${offer.sellable ? `<button type="button" class="hdv-action-btn sell${canSellOne ? ' ok' : ''}" data-action="sell" ${canSellOne ? '' : 'disabled'}>Vendre</button>` : ''}
      </div>
    `;

    row.querySelector('[data-action="buy"]')?.addEventListener('click', () => {
      openAuctionTradeSheet(game, { mode: 'buy', vendorId, offerId, resource, offer });
    });
    row.querySelector('[data-action="sell"]')?.addEventListener('click', () => {
      openAuctionTradeSheet(game, { mode: 'sell', vendorId, offerId, resource, offer });
    });

    listEl.appendChild(row);
  }
}

function mountAuctionNavigation(game, root) {
  const { vendorGroups, activeGroup, activeVendor } = buildAuctionCatalog(game, hdvMainMode);
  const breadcrumb = root.querySelector('#hdv-breadcrumb');
  if (breadcrumb && activeVendor) {
    breadcrumb.textContent = `Place › ${AUCTION_GROUP_LABELS[auctionGroup] || auctionGroup} › ${activeVendor.name}`;
  }

  const tabsEl = root.querySelector('#hdv-group-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = vendorGroups.map((group) => `
      <button type="button" class="hdv-tab${auctionGroup === group.id ? ' active' : ''}" data-auction-group="${group.id}">
        ${group.label}
      </button>
    `).join('');
    tabsEl.querySelectorAll('.hdv-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        auctionGroup = btn.dataset.auctionGroup || 'services';
        auctionCategory = pickDefaultAuctionCategory(Object.entries(getVendorsForHdvMode(game, hdvMainMode)), auctionGroup);
        mountAuctionNavigation(game, root);
        renderAuctionOfferList(game, root);
        root.querySelector('.hdv-list-wrap')?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  const chipsEl = root.querySelector('#hdv-vendor-chips');
  if (chipsEl) {
    chipsEl.innerHTML = (activeGroup?.entries || []).map(([vendorId, vendor]) => `
      <button type="button" class="hdv-chip${auctionCategory === vendorId ? ' active' : ''}${vendor.testHdv ? ' test' : ''}" data-auction-cat="${vendorId}">
        ${vendor.emoji} ${vendor.name}
      </button>
    `).join('');
    chipsEl.querySelectorAll('.hdv-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vendorId = btn.dataset.auctionCat;
        const vendors = game.getMerchantVendors();
        if (vendorId && vendors[vendorId]) {
          auctionCategory = vendorId;
          auctionGroup = getVendorGroupId(vendorId, vendors[vendorId]);
        } else {
          auctionCategory = pickDefaultAuctionCategory(Object.entries(vendors), auctionGroup);
        }
        mountAuctionNavigation(game, root);
        renderAuctionOfferList(game, root);
        root.querySelector('.hdv-list-wrap')?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  const descEl = root.querySelector('#hdv-vendor-desc');
  if (descEl) {
    const desc = activeVendor?.description || '';
    descEl.textContent = desc;
    descEl.hidden = !desc;
  }
}

export function refreshAuctionHouseLight(game) {
  if (!auctionRootEl?.isConnected) return;
  updateAuctionWallet(game, auctionRootEl);
  if (hdvMainMode === 'sell') {
    const grid = auctionRootEl.querySelector('#hdv-sell-grid');
    if (grid) {
      const total = renderInventoryGrid(game, grid, { filter: 'all' });
      const totalEl = auctionRootEl.querySelector('#hdv-sell-total');
      if (totalEl) totalEl.textContent = `Valeur totale : ${formatNumber(total)} 💰`;
    }
    return;
  }
  if (hdvMainMode !== 'npc' && hdvMainMode !== 'test') return;
  const nuggetInfo = game.getGoldNuggetExchangeInfo?.();
  if (nuggetInfo) {
    auctionRootEl.querySelector('#nugget-to-scroll')?.toggleAttribute('disabled', nuggetInfo.owned < nuggetInfo.scrollCost);
    auctionRootEl.querySelector('#nugget-to-kirha')?.toggleAttribute('disabled', nuggetInfo.owned < 1);
  }
  renderAuctionOfferList(game, auctionRootEl);
}

function mountAuctionSellPanel(game, root) {
  const area = root.querySelector('#hdv-content-area');
  const sticky = root.querySelector('.hdv-sticky .hdv-tabs');
  const chips = root.querySelector('#hdv-vendor-chips');
  if (sticky) sticky.innerHTML = '';
  if (chips) chips.innerHTML = '';
  if (!area) return;

  area.innerHTML = `
    <div class="panel-inner hdv-sell-panel">
      <p class="view-desc">Vends tes récoltes et crafts aux PNJ.</p>
      <div class="bank-toolbar">
        <span class="bank-total" id="hdv-sell-total">Valeur totale : 0 💰</span>
        <div class="bank-toolbar-actions">
          <button type="button" class="btn btn-muted btn-small" id="hdv-sell-except">Tout vendre (sauf épinglés)</button>
          <button type="button" class="btn btn-sell-all" id="hdv-sell-all">Tout vendre</button>
        </div>
      </div>
      <div class="inventory-grid" id="hdv-sell-grid"></div>
    </div>
  `;

  area.querySelector('#hdv-sell-all')?.addEventListener('click', () => {
    if (!window.confirm('Vendre tout l\'inventaire ?')) return;
    game.sellEverything();
    refreshAuctionHouseLight(game);
  });
  area.querySelector('#hdv-sell-except')?.addEventListener('click', () => {
    if (!window.confirm('Vendre tout sauf les objets épinglés ?')) return;
    game.sellEverythingExcept(game.state.bankProtected || []);
    refreshAuctionHouseLight(game);
  });

  const total = renderInventoryGrid(game, area.querySelector('#hdv-sell-grid'), { filter: 'all' });
  const totalEl = area.querySelector('#hdv-sell-total');
  if (totalEl) totalEl.textContent = `Valeur totale : ${formatNumber(total)} 💰`;
}

export function renderAuctionHouse(game, el) {
  auctionRootEl = el;

  const online = canUseOnlineFeatures();
  const scrollRes = game.resources.ancient_scroll;
  const nuggetRes = game.resources.gold_nugget;
  const nuggetInfo = game.getGoldNuggetExchangeInfo?.() || null;
  const testBanner = getTestHdvBanner(game.balance);
  const careerPending = isTestHdvEnabled(game.balance) && !game.state.careerChoice?.confirmed;
  const showTest = online && isTestHdvEnabled(game.balance);
  const maintenance = isMaintenanceMode();
  const modes = online
    ? [
      { id: 'npc', label: '📜 Archiviste' },
      { id: 'sell', label: '💰 Vendre' },
      ...(showTest ? [{ id: 'test', label: '🧪 HDV Test' }] : []),
    ]
    : [{ id: 'sell', label: '💰 Vendre' }];
  if (hdvMainMode === 'players') hdvMainMode = 'npc';
  if (!modes.some((m) => m.id === hdvMainMode)) hdvMainMode = modes[0].id;

  el.innerHTML = `
    <div class="view-header"><h2>${iconHtml(getNavIcon('auction_house'), 'view-header-icon', 'Place')} Place marchande</h2>
      ${!online ? `<p class="view-desc">${getOnlineBlockReason()} — la vente PNJ reste disponible.</p>` : ''}
    </div>
    <div class="hdv-view hdv-mode-${hdvMainMode}">
      ${maintenance ? '<p class="hdv-banner warn">Maintenance — HDV joueurs et classement limités.</p>' : ''}
      ${testBanner && hdvMainMode === 'test' ? `<p class="hdv-banner">${testBanner}</p>` : ''}
      ${careerPending && hdvMainMode === 'test' ? '<p class="hdv-banner warn">Termine l\'introduction pour accéder à toutes les ressources test.</p>' : ''}
      <nav class="hdv-main-tabs" id="hdv-main-tabs" aria-label="Type d\'HDV">
        ${modes.map((m) => `<button type="button" class="hdv-main-tab hdv-main-tab--${m.id}${hdvMainMode === m.id ? ' active' : ''}" data-hdv-mode="${m.id}">${m.label}</button>`).join('')}
      </nav>
      <div class="hdv-sticky"${hdvMainMode === 'sell' ? ' hidden' : ''}>
        <div class="hdv-wallet" id="hdv-wallet">
          <span class="hdv-wallet-item"><strong id="hdv-wallet-kirha">${formatNumber(game.state.kirha || 0)}</strong> 💰</span>
          <span class="hdv-wallet-item"><span id="hdv-wallet-scroll-icon">${renderResourceIcon(scrollRes, 'hdv-wallet-icon')}</span> <strong id="hdv-wallet-scrolls">${game.getScrollCount()}</strong></span>
          ${nuggetRes ? `<span class="hdv-wallet-item"><span id="hdv-wallet-nugget-icon">${renderResourceIcon(nuggetRes, 'hdv-wallet-icon')}</span> <strong id="hdv-wallet-nuggets">${nuggetInfo?.owned || 0}</strong></span>` : ''}
        </div>
        <nav class="hdv-tabs" id="hdv-group-tabs" aria-label="Type de marché"></nav>
        <nav class="hdv-chips-scroll" id="hdv-vendor-chips" aria-label="Métier ou vendeur"></nav>
      </div>
      ${nuggetInfo && nuggetRes && hdvMainMode === 'npc' ? `
      <details class="hdv-nuggets">
        <summary>Pépites d'or</summary>
        <div class="hdv-nugget-actions">
          <button type="button" class="hdv-action-btn" id="nugget-to-scroll" ${nuggetInfo.owned < nuggetInfo.scrollCost ? 'disabled' : ''}>${nuggetInfo.scrollCost} → 1 📜</button>
          <button type="button" class="hdv-action-btn" id="nugget-to-kirha" ${nuggetInfo.owned < 1 ? 'disabled' : ''}>1 → ${nuggetInfo.kirhaPerNugget} 💰</button>
        </div>
      </details>` : ''}
      <p class="hdv-vendor-desc" id="hdv-vendor-desc" hidden></p>
      <div class="hdv-list-wrap" id="hdv-content-area">
        <div class="hdv-list" id="auction-offer-list"></div>
      </div>
      ${hdvMainMode === 'sell'
    ? ''
    : '<p class="hdv-tip">Pour vendre tes récoltes aux PNJ, ouvre l’onglet <strong>Vendre</strong>.</p>'}
    </div>
  `;

  el.querySelectorAll('[data-hdv-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.hdvMode;
      if ((next === 'npc' || next === 'test') && !canUseOnlineFeatures()) {
        showAccountRequiredModal(getOnlineBlockReason());
        return;
      }
      hdvMainMode = next;
      renderAuctionHouse(game, el);
    });
  });

  el.querySelector('#goto-bank')?.addEventListener('click', () => navigate('inventory'));
  el.querySelector('#nugget-to-scroll')?.addEventListener('click', () => {
    const result = game.exchangeGoldNuggets('scroll', 1);
    if (!result.ok) emit('farmBlocked', { message: result.reason || 'Échange impossible.' });
    else refreshAuctionHouseLight(game);
  });
  el.querySelector('#nugget-to-kirha')?.addEventListener('click', () => {
    const result = game.exchangeGoldNuggets('kirha', 1);
    if (!result.ok) emit('farmBlocked', { message: result.reason || 'Échange impossible.' });
    else refreshAuctionHouseLight(game);
  });

  if (hdvMainMode === 'sell') {
    mountAuctionSellPanel(game, el);
    return;
  }

  const catalog = buildAuctionCatalog(game, hdvMainMode);
  if (!catalog.vendorEntries.length) {
    el.querySelector('#hdv-content-area').innerHTML = '<p class="empty-text panel-inner">Aucune offre pour le moment.</p>';
    return;
  }

  mountAuctionNavigation(game, el);
  renderAuctionOfferList(game, el);
}

/* ── Inventaire (banque) ── */
export function renderInventoryGrid(game, container, { filter = 'all', onTotal = null } = {}) {
  if (!container) return;
  container.innerHTML = '';
  let totalValue = 0;
  let hasItems = false;
  const protectedIds = new Set(game.state.bankProtected || []);

  for (const [id, amount] of Object.entries(game.state.inventory)) {
    if (amount <= 0) continue;
    const resource = game.resources[id];
    if (!resource) continue;
    const isCraft = !!game.equipment.equipable[id];
    const mealInfo = getInventoryMealInfo(game, id);
    const isCombat = !!resource.combatOnly;
    if (filter === 'resource' && (isCraft || isCombat || mealInfo || resource.craftOnly)) continue;
    if (filter === 'craft' && !isCraft) continue;
    if (filter === 'combat' && !isCombat && !mealInfo) continue;

    hasItems = true;
    const notSellable = resource.notSellable || resource.merchantOnly;
    const isProtected = protectedIds.has(id);
    const bonus = resource.craftOnly && !notSellable ? getCraftSellBonus(game.state, game.jobs) : 1;
    const unitPrice = notSellable ? 0 : Math.floor(resource.sellPrice * bonus);
    const value = unitPrice * amount;
    if (!notSellable && !isProtected) totalValue += value;

    const cell = document.createElement('div');
    cell.className = `inventory-grid-cell${isProtected ? ' pinned' : ''}${notSellable ? ' special' : ''}${mealInfo ? ' meal' : ''}`;
    cell.setAttribute('role', 'button');
    cell.tabIndex = 0;
    cell.title = resource.name;
    cell.innerHTML = `
      ${renderResourceIcon(resource, 'inventory-grid-icon') || `<span class="inventory-grid-emoji">${resource.emoji || '?'}</span>`}
      <span class="inventory-grid-qty">×${amount}</span>
    `;
    if (mealInfo) {
      const healBtn = document.createElement('button');
      healBtn.type = 'button';
      healBtn.className = `inventory-meal-heal-btn${mealInfo.canHeal ? ' affordable' : ''}`;
      healBtn.textContent = mealInfo.canHeal ? 'Se soigner' : 'PV max';
      healBtn.disabled = !mealInfo.canHeal;
      healBtn.title = mealInfo.disabledReason || `Soigne ${mealInfo.effect.label}`;
      healBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const result = game.useInventoryMeal(id);
        if (!result.ok) {
          emit('farmBlocked', { message: result.reason || 'Impossible de consommer ce repas' });
          return;
        }
        refreshInventoryPanels(game);
      });
      cell.appendChild(healBtn);
    }
    cell.addEventListener('click', () => {
      openItemModal(game, id, resource, amount, unitPrice, notSellable);
    });
    cell.addEventListener('keydown', (e) => {
      if (e.target !== cell || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      openItemModal(game, id, resource, amount, unitPrice, notSellable);
    });
    container.appendChild(cell);
  }

  const combatCount = appendOwnedCombatItemsToGrid(game, container, filter);
  if (combatCount) hasItems = true;

  if (!hasItems) {
    container.innerHTML = '<p class="empty-text">Aucun objet dans cette catégorie.</p>';
  }
  if (onTotal) onTotal(totalValue);
  return totalValue;
}

export function renderInventory(game, el) {
  el.innerHTML = `
    <div class="view-header"><h2>${iconHtml(getNavIcon('inventory'), 'view-header-icon', 'Banque')} Banque</h2></div>
    <div class="panel-inner bank-soon-panel">
      <p class="bank-soon-badge">Bientôt disponible</p>
      <p class="view-desc">La Banque arrive bientôt. En attendant, tes objets sont sur <button type="button" class="link-btn" id="goto-char-bag">Perso → Sac</button>, et la vente PNJ est à la <button type="button" class="link-btn" id="goto-hdv-sell">Place marchande → Vendre</button>.</p>
    </div>
  `;

  el.querySelector('#goto-char-bag')?.addEventListener('click', () => {
    charTab = 'bag';
    navigate('character');
  });
  el.querySelector('#goto-hdv-sell')?.addEventListener('click', () => {
    hdvMainMode = 'sell';
    navigate('auction_house');
  });
}

function openItemModal(game, resourceId, resource, amount, unitPrice, notSellable = false) {
  const modal = document.getElementById('item-modal');
  const body = document.getElementById('item-modal-body');
  if (!modal || !body) return;

  const isProtected = (game.state.bankProtected || []).includes(resourceId);
  const equipable = Object.entries(game.equipment.equipable).find(([, e]) => e.recipeId === resourceId);
  const recipe = equipable ? game.recipes[resourceId] : null;
  const isCrafted = (game.state.crafted || []).includes(resourceId);
  const isEquipped = isRecipeEquipped(game.state, resourceId);

  const mealInfo = getInventoryMealInfo(game, resourceId);
  const mealEffect = mealInfo?.effect || null;

  let compareHtml = '';
  if (recipe?.effect && isEquipped) {
    compareHtml = `
      <div class="item-stat-compare">
        Déjà équipé : ${recipe.description}
      </div>
    `;
  } else if (recipe?.effect) {
    compareHtml = `<div class="item-stat-compare">${recipe.description}</div>`;
  } else if (notSellable && resource.merchantOnly) {
    compareHtml = '<p class="item-stat-compare">Objet spécial — acheté à la Place marchande. Requis pour de nombreuses fabrications.</p>';
  } else if (mealEffect) {
    const levelNote = mealInfo.levelOk
      ? ''
      : ` · Réservé aux persos niv. ${mealEffect.levelMin}–${mealEffect.levelMax}`;
    const hpNote = mealInfo.maxHp > 0 ? ` · PV entraînement : ${mealInfo.currentHp}/${mealInfo.maxHp}` : '';
    compareHtml = `<p class="item-stat-compare">Repas : ${mealEffect.label}${levelNote}${hpNote}</p>`;
  }

  const sellActions = notSellable
    ? `<button class="btn btn-craft" id="modal-goto-auction">${iconHtml(getNavIcon('auction_house'), 'btn-inline-icon', 'Place')} Place marchande</button>`
    : `
      <button class="btn btn-sell" id="modal-sell-1">Vendre 1</button>
      ${amount >= 5 ? `<button class="btn btn-sell" id="modal-sell-5">×5 · ${formatNumber(unitPrice * 5)} 💰</button>` : ''}
      ${amount >= 10 ? `<button class="btn btn-sell" id="modal-sell-10">×10 · ${formatNumber(unitPrice * Math.min(10, amount))} 💰</button>` : ''}
      ${amount >= 100 ? `<button class="btn btn-sell" id="modal-sell-100">×100 · ${formatNumber(unitPrice * Math.min(100, amount))} 💰</button>` : ''}
      <button class="btn btn-sell-all" id="modal-sell-all">Vendre tout (×${amount}) · ${formatNumber(unitPrice * amount)} 💰</button>
      <button class="btn btn-muted" id="modal-pin">${isProtected ? '📌 Retirer l\'épingle' : '📍 Épingler (exclure des ventes)'}</button>
    `;

  body.innerHTML = `
    <h3 class="item-modal-title">${renderResourceIcon(resource, 'item-modal-icon')} ${resource.name}</h3>
    <p>Quantité : ×${amount}</p>
    ${notSellable ? '' : `<p>Prix unitaire : ${formatNumber(unitPrice)} 💰${isProtected ? ' · <span class="item-pinned-badge">Épinglé</span>' : ''}</p>`}
    ${compareHtml}
    <div class="modal-item-actions">
      ${mealEffect ? `<button type="button" class="btn btn-craft" id="modal-consume-meal" ${mealInfo.canHeal ? '' : 'disabled'} title="${mealInfo.disabledReason || ''}">🍙 Se soigner</button>` : ''}
      ${sellActions}
      ${recipe && isCrafted && !isEquipped ? '<button class="btn btn-craft" id="modal-equip">Équiper</button>' : ''}
      <button class="btn btn-muted" id="modal-close">Fermer</button>
    </div>
  `;

  body.querySelector('#modal-sell-1')?.addEventListener('click', () => {
    game.sell(resourceId, 1);
    modal.classList.remove('active');
    refreshAuctionHouseLight(game);
  });
  for (const qty of [5, 10, 100]) {
    body.querySelector(`#modal-sell-${qty}`)?.addEventListener('click', () => {
      if (qty >= 10 && !window.confirm(`Vendre ×${Math.min(qty, amount)} ${resource.name} ?`)) return;
      game.sell(resourceId, Math.min(qty, amount));
      modal.classList.remove('active');
      refreshAuctionHouseLight(game);
    });
  }
  body.querySelector('#modal-sell-all')?.addEventListener('click', () => {
    if (!window.confirm(`Vendre tout (×${amount}) ${resource.name} ?`)) return;
    game.sell(resourceId);
    modal.classList.remove('active');
    refreshAuctionHouseLight(game);
  });
  body.querySelector('#modal-pin')?.addEventListener('click', () => {
    game.toggleBankProtected(resourceId);
    modal.classList.remove('active');
    refreshInventoryPanels(game);
    refreshAuctionHouseLight(game);
  });
  body.querySelector('#modal-goto-auction')?.addEventListener('click', () => {
    modal.classList.remove('active');
    hdvMainMode = 'sell';
    navigate('auction_house');
  });
  body.querySelector('#modal-equip')?.addEventListener('click', () => {
    game.doEquip(resourceId);
    modal.classList.remove('active');
  });
  body.querySelector('#modal-consume-meal')?.addEventListener('click', () => {
    const result = game.useInventoryMeal(resourceId);
    if (!result.ok) {
      emit('farmBlocked', { message: result.reason || 'Impossible de consommer ce repas' });
      return;
    }
    modal.classList.remove('active');
    refreshInventoryPanels(game);
  });
  body.querySelector('#modal-close')?.addEventListener('click', () => modal.classList.remove('active'));

  modal.classList.add('active');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
}

/* ── Options ── */
function emitPrestigeModal() {
  document.dispatchEvent(new CustomEvent('tokirha:prestige-open'));
}

export function renderOptions(game, el) {
  const info = game.getPrestigeInfo();
  const caps = info.caps || game.getSeasonCapPreview();
  const p = game.state.prestige || {};
  const progress = game.getPrestigeProgress();
  const blockerHtml = info.blockers?.length
    ? `<ul class="prestige-blockers">${info.blockers.map((b) => `<li>${b}</li>`).join('')}</ul>`
    : '';
  const isRegistered = game.state?.meta?.account?.mode === 'registered';
  el.innerHTML = `
    <div class="view-header"><h2>${iconHtml(getNavIcon('options'), 'view-header-icon', 'Options')} Options</h2></div>
    <div id="account-panel-root"></div>
    <div class="panel-inner"><div id="settings-grid" class="settings-grid"></div></div>
    <div class="panel-inner panel-refresh">
      <h3>🔄 Actualisation forcée</h3>
      <p class="view-desc">Vide le cache navigateur et recharge la dernière version. En général inutile : le jeu s’actualise tout seul au lancement.</p>
      <p class="startup-refresh-version" id="options-build-id"></p>
      <button type="button" class="btn btn-prestige" id="reload-app">Vider le cache et actualiser</button>
    </div>
    <div class="panel-inner panel-prestige">
      <h3>🌸 Nouvelle Saison</h3>
      <div id="prestige-info">
        <p>Saison ${info.currentSeason} · Plafonds : perso Nv.${caps.character.cap} · métiers Nv.${caps.jobs.cap}</p>
        <p>Saison ${info.nextSeason} : perso Nv.${caps.nextSeason.character} · métiers Nv.${caps.nextSeason.jobs}</p>
        <p>Bonus actuels : +${Math.round((p.kirhaBonus || 0) * 100)}% 💰 · +${Math.round((p.xpBonus || 0) * 100)}% XP</p>
        <p class="prestige-gain">Saison ${info.nextSeason} : +${info.gainBonuses.kirha}% 💰 · +${info.gainBonuses.xp}% XP</p>
        <p class="view-desc">Prérequis : ${progress.completed}/${progress.total}</p>
        <div class="xp-bar-container prestige-teaser-bar"><div class="xp-bar" style="width:${progress.percent}%"></div></div>
        ${info.canDo
          ? `<p class="prestige-req prestige-ready">Prêt pour la Saison ${info.nextSeason} !</p>`
          : `<p class="prestige-req">Encore requis :</p>${blockerHtml}`}
      </div>
      <button class="btn btn-prestige" id="prestige-btn" type="button" ${info.canDo ? '' : 'disabled'}>Commencer la Saison ${info.nextSeason}</button>
    </div>
    <div class="panel-inner save-panel save-danger-zone">
      <h3>⚠️ Zone sensible</h3>
      <p class="save-info">Ta partie est <strong>sauvegardée automatiquement</strong> sur cet appareil${isRegistered ? ' et dans le cloud' : ''}.</p>
      <p class="save-warn">Réinitialiser efface toute la progression locale et recommence à zéro.</p>
      <button type="button" class="btn btn-danger" id="reset-save">Réinitialiser la partie</button>
      ${isRegistered ? `
        <hr class="options-divider" />
        <p class="save-warn">Supprimer le compte efface définitivement ton compte et tes données en ligne.</p>
        <button type="button" class="btn btn-danger btn-sm" id="options-delete-account">Supprimer mon compte</button>
      ` : ''}
      <p class="save-hint" id="save-hint"></p>
    </div>
  `;

  renderAccountPanel(game, el.querySelector('#account-panel-root'), { hideDelete: true });
  renderSettingsIn(game, el.querySelector('#settings-grid'));

  const buildEl = el.querySelector('#options-build-id');
  if (buildEl) {
    const current = getAppBuildId(game.balance);
    const last = getLastSeenBuildId();
    buildEl.textContent = last && last !== current
      ? `Build actuelle : ${current} · Dernière session : ${last} (obsolète)`
      : `Build actuelle : ${current}`;
  }

  el.querySelector('#reload-app')?.addEventListener('click', async () => {
    const btn = el.querySelector('#reload-app');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Vidage du cache…';
    }
    try {
      await forceAppRefresh(game);
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Vider le cache et actualiser';
      }
      window.location.reload();
    }
  });
  el.querySelector('#prestige-btn')?.addEventListener('click', () => emitPrestigeModal());

  const hint = (msg) => { const h = el.querySelector('#save-hint'); if (h) h.textContent = msg; };

  el.querySelector('#reset-save')?.addEventListener('click', async () => {
    const step1 = confirm('Réinitialiser la partie ? Toute ta progression sera effacée et tu recommenceras à zéro.');
    if (!step1) return;
    game.resetSave();
    await reconcileAuthAfterLocalReset(game);
    showCareerChoiceIfNeeded(game);
    emit('navRefresh');
    hint('Partie réinitialisée.');
  });

  el.querySelector('#options-delete-account')?.addEventListener('click', async () => {
    const typed = prompt('Tape SUPPRIMER pour confirmer la suppression définitive de ton compte :');
    if (typed !== 'SUPPRIMER') return;
    const { deleteMyAccount } = await import('../systems/accountProfile.js');
    const { signOutAccount } = await import('../core/auth.js');
    const result = await deleteMyAccount();
    if (!result.ok) {
      emit('nicknameError', { reason: result.reason || 'Impossible de supprimer le compte.' });
      return;
    }
    await signOutAccount();
    delete game.state.meta?.account;
    location.href = `${location.pathname}?newgame=1`;
  });
}

export function renderSettingsIn(game, container) {
  const s = game.state.settings;
  const dark = s.darkMode ? 'checked' : '';
  container.innerHTML = `
    <label class="setting-row"><span>🔔 Effets sonores</span><input type="checkbox" id="set-sfx" ${s.sfx ? 'checked' : ''}></label>
    <label class="setting-row"><span>Volume SFX</span><input type="range" id="set-sv" min="0" max="100" value="${Math.round((s.sfxVolume ?? 0.35) * 100)}"></label>
    <label class="setting-row"><span>🌙 Mode sombre</span><input type="checkbox" id="set-dark" ${dark}></label>
  `;
  container.querySelector('#set-sfx').addEventListener('change', (e) => game.updateSettings({ sfx: e.target.checked }));
  container.querySelector('#set-sv').addEventListener('input', (e) => game.updateSettings({ sfxVolume: e.target.value / 100 }));
  container.querySelector('#set-dark')?.addEventListener('change', (e) => {
    game.updateSettings({ darkMode: e.target.checked });
    document.documentElement.dataset.theme = e.target.checked ? 'dark' : '';
  });
}

/* ── Zones de combat ── */
function formatDropList(drops, resources) {
  return Object.entries(drops || {})
    .map(([id, spec]) => {
      const res = resources[id];
      return res ? `${renderResourceIcon(res, 'drop-icon')}${res.name}` : id;
    })
    .join(' · ');
}

function renderCombat(game, el) {
  if (!game.isCombatViewUnlocked()) {
    const progress = getFeatureUnlockProgress('combat', game.state, game.balance, game.jobs);
    if (progress) {
      renderLockedUnlockPanel(game, el, progress);
      return;
    }
  }
  const stats = game.getCharacterStats();
  const charProg = game.getCharacterProgress();
  const weaponRef = game.state.combatEquipment?.weapon;
  const weapon = weaponRef ? resolveItem(game.state, weaponRef, game.combatEquipment.items) : null;
  const weaponLabel = weapon
    ? `${weapon.emoji} ${weapon.name}${weapon.className ? ` (${weapon.className})` : ''}`
    : 'Sans arme';
  const ownedMeals = game.getOwnedMeals();
  const healPanelHtml = renderOutOfCombatHealPanel(game);

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('combat'), 'view-header-icon', 'Combat')} Combat</h2>
      <p class="view-desc">${game.getCharacterDisplayName()} · Nv.${charProg.level} · ❤️ ${stats.hp} · ⚔️ ${stats.atk} · 🛡️ ${stats.def}</p>
      <p class="view-desc">Arme : ${weaponLabel} · Équipe : ${1 + game.getActiveCompanionCount()}/3</p>
      ${game.state.combatWear?.solo?.hero != null ? `<p class="view-desc">HP entraînement conservés : ❤️ ${game.state.combatWear.solo.hero}</p>` : ''}
      <p class="view-desc">🗝️ Farm les <strong>clés</strong> en combat rapide (faible %) · 🍱 <strong>Repas</strong> indispensables en donjon.</p>
      ${ownedMeals.length > 0 ? `
        <p class="view-desc meal-combat-hint">🍱 ${ownedMeals.length} type(s) de repas — menu <strong>Objets</strong> (% PV max).</p>
      ` : ''}
    </div>
    ${healPanelHtml}
    <div id="combat-zone-list"></div>
  `;

  el.querySelectorAll('[data-inventory-meal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = game.useInventoryMeal(btn.dataset.inventoryMeal);
      if (!result.ok) {
        emit('farmBlocked', { message: result.reason || 'Impossible de consommer ce repas' });
        return;
      }
      renderCombat(game, el);
    });
  });

  const list = el.querySelector('#combat-zone-list');

  for (const combatZone of Object.values(game.combatZones)) {
    const zone = game.balance.zones[combatZone.zone];
    const zoneUnlocked = game.isZoneUnlocked(combatZone.zone);
    const bossKills = game.state.bossKills?.[combatZone.id] || 0;
    const dungeonCheck = game.canEnterDungeonZone(combatZone.id);
    const roomCount = (combatZone.monsters?.length || 0) + (combatZone.boss ? 1 : 0);

    const rec = game.getCombatZoneRecommendation(combatZone.id);
    const recLine = rec?.recommendedAtk
      ? `Recommandé : Perso Nv.${rec.charLevel} · ⚔️ ~${rec.recommendedAtk}`
      : `Recommandé : Perso Nv.${combatZone.requiredCharLevel}`;

    const card = document.createElement('div');
    card.className = `dungeon-card combat-zone-card${!zoneUnlocked ? ' locked' : ''}`;
    card.innerHTML = `
      <div class="combat-zone-head">
        <span class="world-name">${combatZone.emoji} ${combatZone.name}</span>
        <p class="world-desc">${zone?.emoji || ''} ${zone?.name || ''} · ${recLine} · Victoires donjon : ${bossKills}</p>
        ${!zoneUnlocked ? '<p class="tile-lock">🔒 Zone verrouillée</p>' : ''}
      </div>
      <div class="combat-dungeon-entry">
        <p class="view-desc">Donjon multi-salles — <strong>1 clé</strong> consommée à l'entrée. Équipement droppé ici uniquement.</p>
        <p class="view-desc">🗝️ Clés en stock : <strong>${game.getDungeonKeyCount(combatZone.id)}</strong></p>
        <button type="button" class="btn btn-prestige btn-dungeon-run" ${zoneUnlocked && dungeonCheck.ok ? '' : 'disabled'} title="${dungeonCheck.reason || ''}">
          🚪 Entrer dans le donjon
        </button>
      </div>
      <details class="combat-training-details" open>
        <summary>Entraînement rapide (1 combat · héros seul)</summary>
        <div class="combat-monster-list" data-zone="${combatZone.id}"></div>
      </details>
    `;

    card.querySelector('.btn-dungeon-run')?.addEventListener('click', () => {
      const result = game.startDungeonRun(combatZone.id);
      if (!result?.ok && result?.reason) showCombatResult(game, result);
    });

    const monsterList = card.querySelector('.combat-monster-list');

    combatZone.monsters.forEach((monster, index) => {
      const kills = game.state.combatKillStats?.[monster.enemyId] || 0;
      const fightCheck = zoneUnlocked
        ? game.canStartFight(combatZone.id, false, index)
        : { ok: false, reason: 'Zone verrouillée' };
      const unlockProg = game.getTrainingUnlock(combatZone.id, false, index);
      const row = document.createElement('div');
      row.className = `combat-monster-row${!unlockProg.ok ? ' combat-monster-locked' : ''}`;
      let progressLine;
      if (index === 0) {
        progressLine = `Victoires : ${kills}`;
      } else if (unlockProg.ok) {
        progressLine = `Débloqué · Victoires : ${kills}`;
      } else {
        const cur = unlockProg.current || 0;
        const req = unlockProg.required || 0;
        progressLine = `Déblocage : ${cur}/${req} vs ${unlockProg.prevName || 'précédent'}`;
      }
      row.innerHTML = `
        <div class="combat-monster-info">
          <span>${!unlockProg.ok ? '🔒 ' : ''}${monster.emoji} ${monster.name}</span>
          <small class="combat-drops">${formatDropList(monster.drops, game.resources)}</small>
          <small class="combat-kill-progress${unlockProg.ok ? ' combat-kill-ok' : ''}">${progressLine}</small>
        </div>
        <button type="button" class="btn btn-craft btn-fight" ${fightCheck.ok ? '' : 'disabled'} title="${fightCheck.reason || unlockProg.reason || ''}">Combattre</button>
      `;
      row.querySelector('.btn-fight')?.addEventListener('click', () => {
        const result = game.startCombatFight(combatZone.id, index, false);
        if (!result?.ok && result?.reason) showCombatResult(game, result);
      });
      monsterList.appendChild(row);
    });

    const boss = combatZone.boss;
    const bossFight = zoneUnlocked
      ? game.canStartFight(combatZone.id, true, 0)
      : { ok: false, reason: 'Zone verrouillée' };
    const bossProg = game.getTrainingUnlock(combatZone.id, true, 0);
    const bossSoloKills = game.state.combatKillStats?.[`boss_${boss.enemyId}`] || 0;
    const bossRow = document.createElement('div');
    bossRow.className = `combat-monster-row combat-boss-row${!bossProg.ok ? ' combat-monster-locked' : ''}`;
    const bossProgress = bossProg.ok
      ? `Boss débloqué · Victoires : ${bossSoloKills}`
      : `Déblocage : ${bossProg.current || 0}/${bossProg.required || 15} vs ${bossProg.prevName || 'dernier monstre'}`;
    bossRow.innerHTML = `
      <div class="combat-monster-info">
        <span>${!bossProg.ok ? '🔒 ' : ''}${boss.emoji} ${boss.name} <strong>(Boss)</strong></span>
        <small class="combat-drops">${formatDropList(boss.drops, game.resources)}</small>
        <small class="combat-kill-progress${bossProg.ok ? ' combat-kill-ok' : ''}">${bossProgress}</small>
      </div>
      <button type="button" class="btn btn-prestige btn-fight-boss" ${bossFight.ok ? '' : 'disabled'} title="${bossFight.reason || bossProg.reason || ''}">Boss</button>
    `;
    bossRow.querySelector('.btn-fight-boss')?.addEventListener('click', () => {
      const result = game.startCombatFight(combatZone.id, 0, true);
      if (!result?.ok && result?.reason) showCombatResult(game, result);
    });
    monsterList.appendChild(bossRow);

    list.appendChild(card);
  }
}

function renderOutOfCombatHealPanel(game) {
  const stats = game.getCharacterStats();
  const maxHp = stats.hp;
  const currentHp = game.state.combatWear?.solo?.hero ?? maxHp;
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 100;
  const meals = listOwnedMeals(game.state, game.resources, game.balance);
  const needsHeal = currentHp < maxHp;
  const hpState = hpPct <= 25 ? ' danger' : hpPct <= 50 ? ' warn' : '';

  const mealButtons = meals.length
    ? meals.map((meal) => {
      const res = game.resources[meal.id];
      const preview = getInventoryMealInfo(game, meal.id);
      return `
        <button type="button" class="btn btn-small combat-heal-meal${preview?.canHeal ? ' affordable' : ''}" data-inventory-meal="${meal.id}" ${preview?.canHeal ? '' : 'disabled'} title="${preview?.disabledReason || meal.effect.label}">
          ${res?.emoji || '🍙'} ${res?.name || meal.id} · ×${meal.qty} · ${meal.effect.label}
        </button>
      `;
    }).join('')
    : '<p class="empty-text">Aucun repas en stock. Prépare-en à la Cuisine pour récupérer entre deux entraînements.</p>';

  return `
    <section class="panel-inner combat-heal-panel">
      <div class="combat-heal-head">
        <div>
          <h3>🍱 Soin hors combat</h3>
          <p class="view-desc">Soigne tes PV d'entraînement avant de relancer un combat rapide.</p>
        </div>
        <strong class="combat-heal-value${hpState}">❤️ ${currentHp}/${maxHp}</strong>
      </div>
      <div class="combat-heal-bar${hpState}"><div class="combat-heal-fill" style="width:${hpPct}%"></div></div>
      ${needsHeal ? `<div class="combat-heal-actions">${mealButtons}</div>` : '<p class="empty-text">PV déjà au maximum.</p>'}
    </section>
  `;
}

function getCombatDialogue(combat) {
  const log = combat?.log || [];
  const last = log[log.length - 1];
  if (last?.text) return last.text;
  if (combat?.phase === 'enemy') {
    const active = getActiveEnemy(combat);
    if (active) return `Tour de ${active.emoji} ${active.name}…`;
  }
  const living = getLivingEnemies(combat);
  if (living.length > 1) return `${living.length} ennemis t'affrontent !`;
  if (living[0]) return `${living[0].emoji} ${living[0].name} t'attend !`;
  return 'Le combat commence !';
}

function detectTurnAnim(logBefore, logAfter) {
  const newEntries = logAfter.slice(logBefore);
  const enemyHit = newEntries.find((e) => e.type === 'player' && e.enemyId);
  const playerHit = newEntries.find((e) => e.type === 'enemy');
  return {
    flashEnemy: newEntries.some((e) => e.type === 'player'),
    flashPlayer: newEntries.some((e) => e.type === 'enemy'),
    hitMemberId: playerHit?.memberId || null,
    hitEnemyId: enemyHit?.enemyId || null,
    activeEnemyId: playerHit?.enemyId || playerHit?.enemyId || null,
  };
}

function playCombatHitAnim(body, anim) {
  if (!anim.flashEnemy && !anim.flashPlayer) return;
  requestAnimationFrame(() => {
    if (anim.flashEnemy) {
      const sel = anim.hitEnemyId
        ? `.dq-enemy-card[data-enemy-id="${anim.hitEnemyId}"] .dq-sprite-enemy`
        : '.dq-sprite-enemy';
      body.querySelector(sel)?.classList.add('dq-hit');
    }
    if (anim.flashPlayer) {
      const targetId = anim.hitMemberId || 'hero';
      body.querySelector(`.dq-sprite-party[data-member-id="${targetId}"]`)?.classList.add('dq-hit');
    }
    setTimeout(() => {
      body.querySelectorAll('.dq-sprite-enemy.dq-hit').forEach((el) => el.classList.remove('dq-hit'));
      body.querySelectorAll('.dq-sprite-party.dq-hit').forEach((el) => el.classList.remove('dq-hit'));
    }, 480);
  });
}

function continueAfterCombatAction(game, body, logBefore) {
  const after = game.getActiveCombat();
  if (!after) return;
  const anim = detectTurnAnim(logBefore, after.encounter.combat?.log || []);
  renderDungeonCombatBody(game);
  playCombatHitAnim(body, anim);
  if (after.encounter.combat?.phase === 'enemy') {
    setTimeout(() => processEnemyTurnSequence(game, body), 520);
  }
}

function processEnemyTurnSequence(game, body) {
  const active = game.getActiveCombat();
  if (!active || active.encounter.combat?.phase !== 'enemy') return;

  renderDungeonCombatBody(game);

  setTimeout(() => {
    const current = game.getActiveCombat();
    if (!current || current.encounter.combat?.phase !== 'enemy') return;

    const logBefore = current.encounter.combat.log.length;
    const result = game.stepCombatEnemyTurn();
    resetCombatUiTurn();

    if (result?.cleared || result?.victory === false) {
      closeDungeonCombatModal();
      showCombatResult(game, result);
      return;
    }

    const after = game.getActiveCombat();
    if (!after) return;

    const anim = detectTurnAnim(logBefore, after.encounter.combat?.log || []);
    renderDungeonCombatBody(game);
    playCombatHitAnim(body, anim);

    if (after.encounter.combat?.phase === 'enemy') {
      setTimeout(() => processEnemyTurnSequence(game, body), 520);
    }
  }, 420);
}

function executeCombatTurn(game, body, actionFn) {
  const active = game.getActiveCombat();
  if (!active) return;
  const logBefore = active.encounter.combat?.log?.length || 0;
  const result = actionFn();
  if (!result) return;
  resetCombatUiTurn();
  if (result?.cleared || result?.victory === false) {
    closeDungeonCombatModal();
    showCombatResult(game, result);
    return;
  }
  continueAfterCombatAction(game, body, logBefore);
}

function renderDungeonCombatBody(game) {
  const body = document.getElementById('dungeon-combat-body');
  const active = game.getActiveCombat();
  if (!body || !active) return;

  const { encounter: run, zone: combatZone } = active;
  const combat = run.combat;
  const isSoloFight = !!run.isSoloFight || !run.isDungeonRun;
  const allEnemies = combat?.enemies || [];
  const livingEnemies = getLivingEnemies(combat);
  const isPlayerTurn = combat?.phase === 'player';
  const isEnemyTurn = combat?.phase === 'enemy';
  const activeMember = game.getActiveCombatMember();
  const party = run.party || [];
  const isBoss = !!run.isBoss;
  const skills = game.getPlayerCombatSkills();
  const { attacks } = splitSkillsByDqMenu(skills);
  const roomLabel = run.isDungeonRun
    ? `Salle ${(run.roomIndex ?? 0) + 1}/${run.rooms?.length || '?'}${isBoss ? ' · 👑 Boss' : ''}`
    : `${isBoss ? '👑 Boss' : 'Entraînement'} · Équipe ${party.length} · ${livingEnemies.length} ennemi${livingEnemies.length !== 1 ? 's' : ''}`;

  const pendingSkillDef = combatUi.pendingSkill ? skills.find((s) => s.id === combatUi.pendingSkill) : null;
  const targetMode = combatUi.step === 'target' ? (combatUi.targetMode || getSkillTargetMode(pendingSkillDef)) : null;
  const canAct = isPlayerTurn && combatUi.step === 'action';

  const soloHpNote = isSoloFight && game.state.combatWear?.solo?.hero != null
    ? ` · HP entraînement : ${game.state.combatWear.solo.hero}`
    : '';
  const hpStateClass = (pct) => (pct <= 25 ? ' hp-danger' : pct <= 50 ? ' hp-warn' : '');

  const partyHtml = party.map((member, index) => {
    const hpPct = Math.max(0, (member.hp / member.maxHp) * 100);
    const isActive = isPlayerTurn && combat.activeMemberIndex === index && member.hp > 0;
    const isTargetable = targetMode === 'ally' && member.hp > 0;
    const tag = isTargetable ? 'button' : 'div';
    return `
      <${tag}${isTargetable ? ' type="button"' : ''} class="dq-party-member${isActive ? ' dq-active-fighter' : ''}${member.hp <= 0 ? ' dq-ko' : ''}${isTargetable ? ' dq-targetable' : ''}"
        ${isTargetable ? `data-target-id="${member.id}"` : ''}>
        <div class="dq-sprite dq-sprite-party" data-member-id="${member.id}" aria-hidden="true">${member.emoji}</div>
        <div class="dq-fighter-name">${member.name}</div>
        <div class="dq-mini-hp${hpStateClass(hpPct)}" aria-hidden="true"><div class="dq-mini-hp-fill" style="width:${hpPct}%"></div></div>
        ${isActive ? '<span class="dq-active-cursor" aria-hidden="true">▶</span>' : ''}
      </${tag}>
    `;
  }).join('');

  const enemiesHtml = allEnemies.map((foe, index) => {
    if (foe.hp <= 0) return '';
    const hpPct = Math.max(0, (foe.hp / foe.maxHp) * 100);
    const isActiveFoe = isEnemyTurn && combat.activeEnemyIndex === index;
    const isTargetable = targetMode === 'enemy';
    const tag = isTargetable ? 'button' : 'div';
    return `
      <${tag}${isTargetable ? ' type="button"' : ''}
        class="dq-enemy-card${foe.boss ? ' dq-enemy-boss' : ''}${isActiveFoe ? ' dq-active-enemy' : ''}${isTargetable ? ' dq-targetable' : ''}"
        data-enemy-id="${foe.id}" ${isTargetable ? `data-target-id="${foe.id}"` : ''}>
        <div class="dq-sprite dq-sprite-enemy${foe.boss ? ' dq-sprite-boss' : ''}" aria-hidden="true">${foe.emoji}</div>
        <div class="dq-enemy-plate">
          <div class="dq-enemy-label">${foe.name}</div>
          <div class="dq-mini-hp dq-mini-hp-enemy${hpStateClass(hpPct)}" aria-hidden="true"><div class="dq-mini-hp-fill" style="width:${hpPct}%"></div></div>
          <div class="dq-enemy-hp">${foe.hp}/${foe.maxHp}</div>
        </div>
      </${tag}>
    `;
  }).join('');

  const partyStatusHtml = party.map((member) => {
    const hpPct = Math.max(0, (member.hp / member.maxHp) * 100);
    const isActive = isPlayerTurn && activeMember?.id === member.id;
    return `
      <div class="dq-status-chip${member.hp <= 0 ? ' dq-ko' : ''}${isActive ? ' dq-status-active' : ''}">
        <span class="dq-status-name">${member.emoji} ${member.name}</span>
        <div class="dq-status-hp${hpStateClass(hpPct)}"><div class="dq-status-hp-fill" style="width:${hpPct}%"></div></div>
        <span class="dq-status-num">${member.hp}/${member.maxHp}</span>
      </div>
    `;
  }).join('');

  let dialogue;
  if (combatUi.step === 'target' && pendingSkillDef && activeMember) {
    dialogue = targetMode === 'enemy'
      ? `${activeMember.emoji} ${activeMember.name} — quel ennemi viser avec ${pendingSkillDef.emoji} ${pendingSkillDef.name} ?`
      : `${activeMember.emoji} ${activeMember.name} — qui soigner avec ${pendingSkillDef.emoji} ${pendingSkillDef.name} ?`;
  } else if (combatUi.menu === 'attack' && canAct) {
    dialogue = `${activeMember?.emoji || '⚔️'} ${activeMember?.name || 'Héros'} — quelle action ?`;
  } else if (combatUi.menu === 'items' && canAct) {
    dialogue = `${activeMember?.emoji || '🎒'} ${activeMember?.name || 'Héros'} — quel repas utiliser ? (1 par combattant et par tour)`;
  } else if (isPlayerTurn && activeMember) {
    dialogue = `${activeMember.emoji} ${activeMember.name} se prépare au combat.`;
  } else {
    dialogue = getCombatDialogue(combat);
  }

  let commandHtml = '';
  if (combatUi.step === 'target') {
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-wide dq-target-cancel">◀ Annuler</button>
    `;
  } else if (combatUi.menu === 'attack' && canAct) {
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-back" data-menu="main">◀ Retour</button>
      ${attacks.map((skill) => {
        const maxUses = getSkillMaxUses(skill, run);
        const left = getSkillUsesLeft(skill, run);
        const limited = maxUses != null;
        const exhausted = limited && left <= 0;
        const countLabel = limited ? ` · ${left}/${maxUses}` : '';
        const hint = exhausted ? ' (épuisé)' : '';
        return `
        <button type="button" class="dq-cmd-btn${exhausted ? '' : ' affordable'}${limited ? ' dq-cmd-limited' : ''}" data-skill="${skill.id}" ${exhausted ? 'disabled' : ''} title="${limited ? `${left} utilisation(s) restante(s) sur ${maxUses}` : ''}">
          <span class="dq-cmd-icon">${skill.emoji}</span>
          <span class="dq-cmd-label">${skill.name}${countLabel}${hint}</span>
        </button>`;
      }).join('')}
    `;
  } else if (combatUi.menu === 'items' && canAct) {
    const ownedMeals = listOwnedMeals(game.state, game.resources, game.balance);
    const memberAte = !!activeMember?.mealUsedThisRound;
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-back" data-menu="main">◀ Retour</button>
      ${memberAte ? '<p class="dq-cmd-empty">Ce combattant a déjà mangé ce tour.</p>' : ''}
      ${!memberAte && ownedMeals.length ? ownedMeals.map((m) => {
        const res = game.resources[m.id];
        return `<button type="button" class="dq-cmd-btn dq-cmd-meal affordable" data-meal="${m.id}">
          <span class="dq-cmd-icon">${res?.emoji || '🍙'}</span>
          <span class="dq-cmd-label">${res?.name || m.id} ${m.effect.label} · ×${m.qty}</span>
        </button>`;
      }).join('') : ''}
      ${!memberAte && !ownedMeals.length ? '<p class="dq-cmd-empty">Aucun repas en stock — fabrique-en à la Cuisine.</p>' : ''}
    `;
  } else {
    const ownedMeals = listOwnedMeals(game.state, game.resources, game.balance);
    const mealCount = countOwnedMeals(game.state, game.resources, game.balance);
    const memberAte = !!activeMember?.mealUsedThisRound;
    const canUseMeal = canAct && mealCount > 0 && !memberAte;
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-main affordable" data-menu="attack" ${canAct ? '' : 'disabled'}>
        <span class="dq-cmd-icon">⚔️</span><span class="dq-cmd-label">Attaquer</span>
      </button>
      <button type="button" class="dq-cmd-btn dq-cmd-main dq-cmd-items${canUseMeal ? ' affordable' : ''}" data-menu="items" ${canAct ? '' : 'disabled'}>
        <span class="dq-cmd-icon">🎒</span><span class="dq-cmd-label">Objets${mealCount > 0 ? ` (${mealCount})` : ''}</span>
      </button>
      <button type="button" class="dq-cmd-btn dq-cmd-main btn-combat-flee">
        <span class="dq-cmd-icon">🏃</span><span class="dq-cmd-label">Fuir</span>
      </button>
    `;
  }

  const phaseLabel = isPlayerTurn ? 'Ton tour' : 'Tour ennemi';
  const ownedMealsStrip = listOwnedMeals(game.state, game.resources, game.balance);
  const mealsStripHtml = ownedMealsStrip.length
    ? `<div class="dq-meals-strip" aria-label="Repas en stock">
        ${ownedMealsStrip.map((m) => {
          const res = game.resources[m.id];
          return `<span class="dq-meal-chip" title="${res?.name || m.id} ${m.effect.label}">${
            res?.emoji || '🍙'
          }×${m.qty}</span>`;
        }).join('')}
      </div>`
    : '';

  body.innerHTML = `
    <div class="dq-combat${isSoloFight ? ' dq-solo-fight' : ''}">
      <div class="dq-header">
        <span class="dq-zone-name">${combatZone?.emoji || '⚔️'} ${combatZone?.name || 'Combat'}</span>
        <span class="dq-phase-badge">${phaseLabel}</span>
        <span class="dq-room">${roomLabel}${soloHpNote}</span>
      </div>
      ${mealsStripHtml}

      ${isEnemyTurn ? '<div class="dq-enemy-turn-banner" aria-live="polite">⚔️ Tour de l\'ennemi…</div>' : ''}

      <div class="dq-battlefield${isBoss ? ' dq-boss-room' : ''}${targetMode === 'enemy' ? ' dq-pick-enemy' : ''}${isEnemyTurn ? ' dq-enemy-turn' : ''}">
        <div class="dq-sky"></div>
        <div class="dq-ground"></div>
        <div class="dq-arena-ring" aria-hidden="true"></div>
        <div class="dq-depth-lines" aria-hidden="true"></div>
        <div class="dq-battle-vignette" aria-hidden="true"></div>
        <div class="dq-battle-hud" aria-hidden="true">
          <span class="dq-hud-pill">👥 ${party.filter((m) => m.hp > 0).length}/${party.length}</span>
          <span class="dq-hud-vs">VS</span>
          <span class="dq-hud-pill">${isBoss ? '👑 ' : '👾 '}${livingEnemies.length}/${allEnemies.length}</span>
        </div>
        <div class="dq-turn-ribbon${isEnemyTurn ? ' enemy' : ' player'}" aria-hidden="true">
          ${isEnemyTurn ? 'Tour ennemi' : activeMember ? `Tour de ${activeMember.name}` : 'Ton tour'}
        </div>
        <div class="dq-party-allies">${partyHtml}</div>
        <div class="dq-enemies-group">${enemiesHtml}</div>
        <div class="dq-party-status">${partyStatusHtml}</div>
      </div>

      <div class="dq-console">
        <div class="dq-dialogue">
          <p class="dq-dialogue-text">${dialogue}</p>
        </div>
        <nav class="dq-command-menu" aria-label="Commandes de combat">${commandHtml}</nav>
      </div>
    </div>
  `;

  body.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      combatUi = { ...combatUi, menu: btn.dataset.menu };
      renderDungeonCombatBody(game);
    });
  });

  body.querySelectorAll('[data-skill]').forEach((btn) => {
    btn.addEventListener('click', () => pickCombatSkill(game, body, btn.dataset.skill, skills, livingEnemies));
  });

  const pickTarget = (targetId) => {
    if (!combatUi.pendingSkill) return;
    executeCombatTurn(game, body, () => game.useCombatSkill(combatUi.pendingSkill, targetId));
  };

  body.querySelectorAll('[data-target-id]').forEach((btn) => {
    btn.addEventListener('click', () => pickTarget(btn.dataset.targetId));
  });

  body.querySelector('.dq-target-cancel')?.addEventListener('click', () => {
    resetCombatUiTurn();
    renderDungeonCombatBody(game);
  });

  body.querySelectorAll('[data-meal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      executeCombatTurn(game, body, () => {
        const result = game.useCombatMeal(btn.dataset.meal);
        if (!result?.ok && result?.reason) {
          emit('farmBlocked', { message: result.reason });
          return null;
        }
        return result;
      });
    });
  });

  body.querySelector('.btn-combat-flee')?.addEventListener('click', () => {
    resetCombatUiTurn();
    game.abandonCombat();
    closeDungeonCombatModal();
  });
}

export function closeDungeonCombatModal() {
  document.getElementById('dungeon-combat-modal')?.classList.remove('active');
}

export function openDungeonCombatModal(game) {
  const modal = document.getElementById('dungeon-combat-modal');
  if (!modal) return;
  resetCombatUi();
  renderDungeonCombatBody(game);
  modal.classList.add('active');
}

export function refreshDungeonCombatModal(game) {
  if (!document.getElementById('dungeon-combat-modal')?.classList.contains('active')) return;
  renderDungeonCombatBody(game);
}

export function showCombatResult(game, result) {
  const modal = document.getElementById('dungeon-result-modal');
  const body = document.getElementById('dungeon-result-body');
  if (!modal || !body) return;

  if (result.cleared) {
    let lootHtml = '';
    for (const [resId, amount] of Object.entries(result.drops || {})) {
      const res = game.resources[resId];
      lootHtml += `<div class="offline-gain-row">${renderResourceIcon(res, 'loot-icon')}+${amount} ${res?.name || resId}</div>`;
    }
    for (const drop of result.equipmentDrops || []) {
      lootHtml += `<div class="offline-gain-row">${drop.emoji || '⚔️'} ${drop.name} ${RARITY_EMOJI[drop.rarity] || ''}</div>`;
    }
    if (result.keyDropped) {
      const keyId = getDungeonKeyId(result.zoneId);
      lootHtml += `<div class="offline-gain-row">🗝️ ${game.resources[keyId]?.name || keyId}</div>`;
    }
    const title = result.isDungeon
      ? `🏰 Donjon terminé ! (${result.roomCount || ''} salles)`
      : `${result.isBoss ? '👑' : '🏆'} Victoire !`;
    body.innerHTML = `
      <h2>${title}</h2>
      <div class="modal-gains">
        <div class="offline-gain-row">+${result.charXp || 0} XP personnage</div>
        ${lootHtml || '<div class="offline-gain-row">Aucun butin cette fois.</div>'}
      </div>
      ${result.levelResult ? `<p>🧘 Personnage Nv.${result.levelResult.level} !</p>` : ''}
      ${result.partyRestored ? '<p class="modal-desc">🌸 Équipe reposée — tous les PV ont été restaurés.</p>' : ''}
      <button class="btn btn-modal-close" id="dungeon-close">Continuer</button>
    `;
  } else if (result.victory === false) {
    const failTitle = result.isDungeon ? '💀 Défaite dans le donjon' : '💀 Défaite';
    body.innerHTML = `
      <h2>${failTitle}</h2>
      <p class="modal-desc">${result.isDungeon ? 'L\'équipe a été vaincue. Aucune récompense du donjon.' : 'L\'équipe a été vaincue au combat.'}</p>
      <button class="btn btn-modal-close" id="dungeon-close">Continuer</button>
    `;
  } else {
    body.innerHTML = `
      <h2>${iconHtml(getNavIcon('combat'), 'view-header-icon', 'Combat')} Combat</h2>
      <p class="modal-desc">${result.reason || 'Impossible de combattre.'}</p>
      <button class="btn btn-modal-close" id="dungeon-close">Fermer</button>
    `;
  }

  body.querySelector('#dungeon-close')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  modal.classList.add('active');
}

export function showDungeonResult(game, result) {
  showCombatResult(game, result);
}

export function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString('fr-FR');
}

export function initSakuraPetals() {
  const container = document.getElementById('sakura-petals');
  if (!container || container.children.length > 0) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const isTouch = window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches;
  // Mobile : pas de pétales (économie batterie / chauffe)
  if (reduceMotion || isTouch) {
    container.hidden = true;
    return;
  }

  const count = 3;
  for (let i = 0; i < count; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.left = `${10 + Math.random() * 80}%`;
    petal.style.animationDuration = `${16 + Math.random() * 10}s`;
    petal.style.animationDelay = `${Math.random() * 8}s`;
    petal.style.opacity = `${0.18 + Math.random() * 0.2}`;
    container.appendChild(petal);
  }
}

export function showOfflineModal(game, els, result) {
  els.offlineDuration.textContent = `Tu étais absent ${formatOfflineDuration(result.effectiveMs)}`;
  if (result.zenOnly) {
    els.offlineGains.innerHTML = '<p class="offline-zen">Rien n\'a poussé sans toi. 🌸</p>';
    els.offlineCap.textContent = 'La récolte demande ta présence aux emplacements actifs.';
  } else {
    els.offlineGains.innerHTML = '';
    for (const [resId, amount] of Object.entries(result.gains || {})) {
      const res = game.resources[resId];
      const row = document.createElement('div');
      row.className = 'offline-gain-row';
      row.innerHTML = `+${amount} ${renderResourceIcon(res, 'loot-icon')}${res.name}`;
      els.offlineGains.appendChild(row);
    }
    els.offlineCap.textContent = result.capped ? '⏳ Absence limitée à 6h' : '';
  }
  els.offlineModal.classList.add('active');
}
