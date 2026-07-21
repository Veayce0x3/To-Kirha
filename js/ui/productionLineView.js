import { getResourceVisual, renderResourceIcon } from '../systems/resourceVisual.js';
import {
  canAffordFeed,
  getBuildingDef,
  isUnifiedFarmBuilding,
  getUnifiedFarmLineKey,
  getFarmProductionLineIds,
  getFarmProductionXp,
  getPrimaryFeedId,
  getFeedCost,
} from '../systems/farm.js';
import { getFarmBuildingProgress } from '../systems/farmProgress.js';
import { getFarmBuildingIcon, getJobIcon, iconHtml } from '../core/assets.js';
import {
  getVisibleProductionResources,
  getEmptyAnimalSlotIndex,
  getNextAnimalSlotUnlock,
  formatAnimalCostParts,
  ensureFarmUnitsForAnimalSlots,
} from '../systems/productionLines.js';
import { getHarvestTime, getHarvestXp } from '../systems/harvest.js';
import { getPrestigeBonuses, applyMultiplierBonus, getSeasonBonusPercents, getSeasonBoostMult } from '../systems/prestige.js';
import { getHarvestToolCheck, getFarmToolCheck } from '../systems/toolTier.js';
import { getToolUsesRemaining, isDurabilityTool } from '../systems/toolDurability.js';
import { getJobEquippedTool } from '../systems/equipment.js';
import { emit } from '../core/events.js';
import {
  navigate,
  getView,
  getHarvestViewForJob,
  getFarmViewForBuilding,
} from './router.js';
import {
  getVisibleHarvestViews,
  getVisibleFarmViews,
  getNextGatheringJobUnlock,
} from '../systems/careerChoice.js';

function formatNumber(n) {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 10_000) return `${(x / 1_000).toFixed(1)}K`;
  const rounded = Math.round(x * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) > 1e-9) {
    return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }
  return Math.round(rounded).toLocaleString('fr-FR');
}

function formatTimerMs(ms) {
  if (ms == null || ms <= 0) return '0s';
  const sec = Math.max(1, Math.ceil(ms / 1000));
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return `${sec}s`;
}

function getHarvestBtnLabel(phase, progress = 0, remainingMs = null) {
  if (phase === 'regrowing' && progress >= 1) return 'Prêt !';
  if (remainingMs != null) {
    const prefix = phase === 'regrowing' ? 'Repousse ' : '';
    return `${prefix}${formatTimerMs(remainingMs)}`;
  }
  const pct = Math.floor(progress * 100);
  if (phase === 'harvesting') return `Récolte ${pct}%`;
  if (phase === 'regrowing') return `Repousse ${pct}%`;
  return 'Récolter';
}

function getSlotRemainingMs(slot) {
  if (!slot?.active) return null;
  const elapsed = Date.now() - (slot.active.start || 0);
  return Math.max(0, (slot.active.duration || 0) - elapsed);
}

function getAdjacentVisibleView(current, visible, direction) {
  const idx = visible.indexOf(current);
  if (idx < 0) return null;
  const next = (idx + direction + visible.length) % visible.length;
  return visible[next] || null;
}

function buildLineUnitCard(game, jobId, resourceId, unitIndex, resource) {
  const progress = game.getLineHarvestProgress(jobId, resourceId, unitIndex);
  const line = game.state.productionLines?.harvest?.[jobId]?.[resourceId];
  const slot = line?.slots?.[unitIndex];
  const active = !!slot?.active;
  const phase = slot?.active?.phase;
  const toolBlock = !active ? game.getHarvestToolBlockReason(jobId, resourceId) : null;
  const canHarvest = !active && !toolBlock;
  const canComplete = active && progress >= 1 && phase === 'regrowing';
  const vis = getResourceVisual(resource, active ? (phase === 'regrowing' ? 'regrowing' : 'harvesting') : 'available');
  const spriteHtml = vis.sprite
    ? `<img class="slot-visual-sprite" src="${vis.sprite}" alt="" />`
    : `<span class="slot-visual-emoji">${vis.emoji || resource.emoji || '🌾'}</span>`;

  const remainingMs = getSlotRemainingMs(slot);
  const progressPct = Math.floor(progress * 100);
  const statusLabel = active
    ? (phase === 'regrowing' && progress >= 1 ? 'Prêt !' : getHarvestBtnLabel(phase, progress, remainingMs))
    : (canHarvest ? 'Prêt' : '');

  const card = document.createElement('div');
  card.className = `harvest-slot production-unit production-unit-tap${active ? ' active-harvest' : ''}${canHarvest || canComplete ? ' slot-can-harvest' : ''}`;
  card.dataset.job = jobId;
  card.dataset.resource = resourceId;
  card.dataset.unit = String(unitIndex);
  card.innerHTML = `
    <div class="slot-visual slot-visual-tap" role="button" tabindex="0" aria-label="${resource.name}${statusLabel ? ` — ${statusLabel}` : ''}">
      ${canHarvest ? '<span class="slot-ready-badge">Prêt</span>' : ''}
      ${spriteHtml}
      ${active ? `<div class="slot-progress-overlay"><div class="slot-progress-fill" style="width:${progressPct}%"></div><span class="slot-progress-label">${statusLabel}</span></div>` : ''}
    </div>
    ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
  `;

  const onTap = () => {
    if (canHarvest) game.startLineHarvest(jobId, resourceId, unitIndex);
    else if (canComplete) game.completeHarvestLine(jobId, resourceId, unitIndex);
  };

  card.querySelector('.slot-visual-tap')?.addEventListener('click', onTap);
  card.querySelector('.slot-visual-tap')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  });
  return card;
}

function getLineToolDurability(game, jobId, resource) {
  const check = getHarvestToolCheck(
    game.state,
    jobId,
    resource,
    game.recipes,
    game.equipment,
    game.resources
  );
  if (!check.ok || !check.recipe) return null;
  const recipeId = getJobEquippedTool(game.state, jobId);
  if (!recipeId || !isDurabilityTool(check.recipe)) return null;
  const remaining = getToolUsesRemaining(game.state, recipeId);
  const max = check.recipe.maxUses;
  if (remaining == null || !max) return null;
  return `${remaining}/${max}`;
}

function getFarmToolDurabilityLabel(game, building) {
  const check = getFarmToolCheck(game.state, game.recipes, game.equipment, building);
  if (!check.ok || !check.recipe) return null;
  const toolKind = building?.toolKind || 'bucket';
  const recipeId = getJobEquippedTool(game.state, 'breeder', toolKind);
  if (!recipeId || !isDurabilityTool(check.recipe)) return null;
  const remaining = getToolUsesRemaining(game.state, recipeId);
  const max = check.recipe.maxUses;
  if (remaining == null || !max) return null;
  const emoji = check.recipe.emoji || '🛠️';
  return `${emoji} ${remaining}/${max}`;
}

function buildHarvestLineSection(game, jobId, resourceId, resource, container) {
  const line = game.state.productionLines?.harvest?.[jobId]?.[resourceId];
  if (!line) return;
  const qty = game.state.inventory[resourceId] || 0;
  const maxUnits = game.balance.productionLines?.maxUnitsPerResource ?? 5;
  const xpPerHarvest = getHarvestXp(resource, game.state, game.balance, game.resources);
  const harvestMs = Math.round(getHarvestTime(resource, game.state, game.jobs, game.balance, game.resources) / 1000);
  const toolDurability = getLineToolDurability(game, jobId, resource);
  const xpBonusPct = getSeasonBonusPercents(game.state).jobXpPct;
  const xpBonusTag = xpBonusPct > 0
    ? `<span class="bonus-tag" title="Bonus XP métiers">+${xpBonusPct}%</span>`
    : '';

  const section = document.createElement('div');
  section.className = 'production-line-section';
  section.dataset.resource = resourceId;
  section.innerHTML = `
    <div class="production-line-head">
      <div class="production-line-title">
        ${renderResourceIcon(resource, 'tile-resource-icon')}
        <strong>${resource.name}</strong>
        <span class="production-stock">Stock : ${qty}</span>
        <span class="production-xp">+${formatNumber(xpPerHarvest)} XP${xpBonusTag}</span>
        ${toolDurability ? `<span class="production-tool-dur">🛠️ ${toolDurability}</span>` : ''}
      </div>
      <div class="production-line-meta">
        <span class="production-units">${line.units}/${maxUnits}</span>
        <span class="production-harvest-time">${harvestMs}s/récolte</span>
      </div>
    </div>
    <div class="slots-grid production-units-grid"></div>
  `;
  const grid = section.querySelector('.production-units-grid');
  for (let i = 0; i < line.units; i++) {
    grid.appendChild(buildLineUnitCard(game, jobId, resourceId, i, resource));
  }
  container.appendChild(section);
}

function formatUnlockCost(game, preview) {
  const parts = [];
  if (preview.kirha > 0) {
    const ok = (game.state.kirha || 0) >= preview.kirha;
    parts.push(`<span class="${ok ? 'ing-ok' : 'ing-missing'}">${formatNumber(preview.kirha)} 💰</span>`);
  }
  if (preview.resources) {
    for (const [resId, amt] of Object.entries(preview.resources)) {
      const res = game.resources[resId];
      const have = game.state.inventory[resId] || 0;
      const cls = have >= amt ? 'ing-ok' : 'ing-missing';
      parts.push(`<span class="${cls}">${renderResourceIcon(res, 'ing-icon') || ''} ${have}/${amt}</span>`);
    }
  }
  return parts.join(' ');
}

function buildUnlockPanel(game, jobId) {
  const preview = game.getNextProductionUnlockPreview(jobId);
  const panel = document.createElement('div');
  panel.className = 'production-unlock-panel';

  if (!preview || preview.kind === 'maxed') {
    panel.innerHTML = '<p class="empty-text">Toutes les lignes de ce métier sont débloquées.</p>';
    return panel;
  }

  if (preview.kind === 'level_blocked') {
    panel.innerHTML = `
      <p class="production-unlock-hint">Prochaine ressource : <strong>${preview.resourceName}</strong></p>
      <button type="button" class="btn btn-upgrade btn-production-unlock" disabled>Débloquer ${preview.resourceName}</button>
      <p class="empty-text">🔒 ${preview.jobName} Nv.${preview.requiredLevel} requis pour continuer.</p>
    `;
    return panel;
  }

  const canBuy = game.canBuyNextProductionUnlock(jobId);
  const costHtml = formatUnlockCost(game, preview);
  let label = '';
  if (preview.kind === 'unit') {
    label = `Débloquer ${preview.resourceName} (${preview.nextUnits}/${preview.maxUnits})`;
  } else {
    label = `Débloquer ${preview.resourceName}`;
  }

  panel.innerHTML = `
    <div class="production-unlock-head">
      <strong>Déblocage</strong>
      <span class="production-unlock-cost">${costHtml}</span>
    </div>
    <button type="button" class="btn btn-upgrade btn-production-unlock"${canBuy ? '' : ' disabled'}>${label}</button>
    <p class="production-unlock-desc">${preview.kind === 'unit'
    ? 'Ajoute une unité de production sur la ressource en cours (max 5 par type). Les coûts augmentent sans reset entre les ressources.'
    : `Ouvre la ressource ${preview.resourceName} avec 1 unité (après 5× ${preview.prevResourceName}).`}</p>
  `;

  panel.querySelector('.btn-production-unlock')?.addEventListener('click', () => {
    if (game.buyNextProductionUnlock(jobId)) {
      const container = document.getElementById('view-container');
      if (container) renderJobProduction(game, container, jobId);
    }
  });

  return panel;
}

function buildNextJobUnlockFooter(game) {
  const nextUnlock = getNextGatheringJobUnlock(game.state, game.balance, game.jobs);
  if (!nextUnlock) return null;

  const pct = Math.floor((nextUnlock.progress || 0) * 100);
  const readyCount = (nextUnlock.gates || []).filter((gate) => gate.ready).length;
  const totalGates = nextUnlock.gates?.length || 0;
  const icon = getJobIcon(nextUnlock.jobId);

  const panel = document.createElement('div');
  panel.className = `job-next-footer${nextUnlock.ready ? ' job-next-footer-ready' : ''}`;
  panel.innerHTML = `
    <p class="job-next-footer-label">Prochain métier</p>
    <button type="button" class="job-inline-unlock" id="job-next-unlock" title="${nextUnlock.hint || ''}">
      ${icon ? iconHtml(icon, 'job-inline-unlock-icon', nextUnlock.label) : nextUnlock.emoji}
      <span class="job-inline-unlock-label">${nextUnlock.label}</span>
      <span class="job-inline-unlock-meta">${nextUnlock.ready ? 'Prêt' : `${readyCount}/${totalGates} prérequis`}</span>
      <span class="job-inline-unlock-bar"><span class="job-inline-unlock-fill" style="width:${pct}%"></span></span>
    </button>
    ${nextUnlock.hint && !nextUnlock.ready ? `<p class="job-unlock-hint">${nextUnlock.hint}</p>` : ''}
  `;
  panel.querySelector('#job-next-unlock')?.addEventListener('click', () => navigate(nextUnlock.viewId));
  return panel;
}

export function renderJobProduction(game, el, jobId) {
  const job = game.jobs[jobId];
  const prog = game.getJobProgress(jobId);
  const pct = (prog.xp / prog.needed) * 100;
  const unlocked = getVisibleProductionResources(game.state, game.resources, jobId);
  const visibleHarvestViews = getVisibleHarvestViews(game.state, game.balance);
  const currentView = getHarvestViewForJob(jobId);
  const prevView = getAdjacentVisibleView(currentView, visibleHarvestViews, -1);
  const nextView = getAdjacentVisibleView(currentView, visibleHarvestViews, 1);

  el.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-top job-nav-header">
        <button type="button" class="btn btn-muted btn-job-nav" id="job-prev" ${prevView ? '' : 'disabled'}>‹</button>
        <div class="job-nav-center">
          <div class="skill-header-title">${job.name}</div>
          <div class="skill-header-meta">Niveau ${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}</div>
        </div>
        <button type="button" class="btn btn-muted btn-job-nav" id="job-next" ${nextView ? '' : 'disabled'}>›</button>
      </div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.atSeasonCap ? `Plafond Saison ${game.state.season || 1}` : `${prog.xp} / ${prog.needed} XP`}</p>
    </div>
    <div class="panel-inner">
      <h3>Lignes de production</h3>
      <p class="view-desc">La première ressource est offerte. Débloque jusqu'à 5 unités, puis passe à la ressource suivante quand ton niveau le permet.</p>
      <div id="production-lines"></div>
      <div id="production-unlock"></div>
      <div id="job-next-footer"></div>
    </div>
  `;

  el.querySelector('#job-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#job-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });

  const linesEl = el.querySelector('#production-lines');
  for (const resource of unlocked) {
    buildHarvestLineSection(game, jobId, resource.id, resource, linesEl);
  }

  const unlockEl = el.querySelector('#production-unlock');
  if (unlockEl) unlockEl.appendChild(buildUnlockPanel(game, jobId));

  const footerSlot = el.querySelector('#job-next-footer');
  const footer = buildNextJobUnlockFooter(game);
  if (footerSlot && footer) footerSlot.appendChild(footer);
  else if (footerSlot) footerSlot.remove();
}

function getFarmBtnLabel(progress = 0, remainingMs = null) {
  if (progress >= 1) return 'Prêt !';
  if (remainingMs != null && remainingMs > 0) return formatTimerMs(remainingMs);
  return 'Production…';
}

function formatSlotFeedCostHtml(building, feedId, resources, renderIcon) {
  const cost = getFeedCost(building, feedId);
  if (!cost || !Object.keys(cost).length) return '';
  return Object.entries(cost).map(([id, qty]) => {
    const res = resources[id];
    const icon = typeof renderIcon === 'function'
      ? (renderIcon(res, 'farm-slot-feed-icon') || '')
      : (res?.emoji || '');
    return `<span class="farm-slot-feed-cost">${icon || ''}<span>×${qty}</span></span>`;
  }).join('');
}

function renderFarmSlotAnimalBlock(game, building, meta, unitIndex, feedId) {
  if (!building.requiresAnimal) return '';
  const animalName = building.animalName || 'Animal';
  const emoji = building.animalEmoji || building.emoji || '🐾';
  const maxCycles = building.animalMaxCycles || 12;
  const animal = meta.animals?.[unitIndex];
  const feedCostHtml = formatSlotFeedCostHtml(building, feedId, game.resources, renderResourceIcon);

  if (animal && (animal.cyclesLeft || 0) > 0) {
    const left = animal.cyclesLeft;
    const pct = Math.max(0, Math.min(100, Math.round((left / maxCycles) * 100)));
    return `
      <div class="farm-slot-animal ok">
        <span class="farm-slot-animal-emoji" aria-hidden="true">${emoji}</span>
        <div class="farm-slot-animal-info">
          <strong>${animalName} ${unitIndex + 1}</strong>
          <span class="farm-slot-animal-meta-row">
            <span class="farm-slot-animal-uses">${left}/${maxCycles} util.</span>
            ${feedCostHtml}
          </span>
          <div class="xp-bar-container farm-slot-animal-bar" role="progressbar" aria-valuenow="${left}" aria-valuemin="0" aria-valuemax="${maxCycles}">
            <div class="xp-bar" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }

  if (animal && (animal.cyclesLeft || 0) <= 0) {
    return `
      <div class="farm-slot-animal dead">
        <span class="farm-slot-animal-emoji" aria-hidden="true">${emoji}</span>
        <div class="farm-slot-animal-info">
          <strong>${animalName} ${unitIndex + 1}</strong>
          <span class="farm-slot-animal-uses">Épuisé — à racheter</span>
        </div>
      </div>`;
  }

  return `
    <div class="farm-slot-animal empty">
      <span class="farm-slot-animal-emoji farm-slot-animal-emoji-empty" aria-hidden="true">${emoji}</span>
      <div class="farm-slot-animal-info">
        <strong>Emplacement ${unitIndex + 1}</strong>
        <span class="farm-slot-animal-uses">Vide — à acheter</span>
      </div>
    </div>`;
}

function buildFarmUnitCard(game, buildingId, lineKey, unitIndex, building) {
  const progress = game.getFarmLineProgress(buildingId, lineKey, unitIndex);
  const line = game.state.productionLines?.farm?.[buildingId]?.[lineKey];
  const slot = line?.slots?.[unitIndex];
  const active = !!slot?.active;
  const meta = game.getFarmMeta(buildingId);
  const animal = building.requiresAnimal ? meta.animals?.[unitIndex] : null;
  const animalReady = !building.requiresAnimal || (!!animal && (animal.cyclesLeft || 0) > 0);
  const needsAnimal = building.requiresAnimal && !animalReady;
  const toolBlock = game.getFarmToolBlockReason(buildingId);
  const needsFeed = Object.keys(building.feed || {}).length > 0;
  const feedId = meta.feedId || getPrimaryFeedId(building);
  if (needsFeed && feedId && meta.feedId !== feedId) {
    game.setFarmFeed(buildingId, feedId);
  }
  const feedBlocked = needsFeed && (!feedId || !canAffordFeed(building, feedId, game.state));
  const blocked = needsAnimal || feedBlocked || toolBlock;
  const canStart = !active && !blocked;
  const canCollect = active && progress >= 1;
  const unified = isUnifiedFarmBuilding(building);

  const buildingIcon = getFarmBuildingIcon(buildingId);
  const spriteHtml = buildingIcon
    ? `<img class="slot-visual-sprite" src="${buildingIcon}" alt="" />`
    : `<span class="slot-visual-emoji">${building.emoji || '🏠'}</span>`;

  const remainingMs = getSlotRemainingMs(slot);
  const progressPct = Math.floor(progress * 100);
  const statusLabel = active
    ? getFarmBtnLabel(progress, remainingMs)
    : (canStart ? 'Produire' : '');

  const animalBlock = renderFarmSlotAnimalBlock(game, building, meta, unitIndex, feedId);

  const card = document.createElement('div');
  const useOverlay = unified || building.tapProgress === true;
  card.className = `farm-slot harvest-slot production-unit${useOverlay ? ' production-unit-tap' : ''}${canStart || canCollect ? ' slot-can-harvest' : ''}${active ? ' active-harvest' : ''}${needsAnimal ? ' farm-slot-no-animal' : ''}`;
  card.dataset.building = buildingId;
  card.dataset.product = lineKey;
  card.dataset.unit = String(unitIndex);

  if (useOverlay) {
    card.innerHTML = `
      <div class="slot-visual slot-visual-tap" role="button" tabindex="0" aria-label="${building.name}${statusLabel ? ` — ${statusLabel}` : ''}">
        ${canStart ? '<span class="slot-ready-badge">Prêt</span>' : ''}
        ${spriteHtml}
        ${active ? `<div class="slot-progress-overlay"><div class="slot-progress-fill" style="width:${progressPct}%"></div><span class="slot-progress-label">${statusLabel}</span></div>` : ''}
      </div>
      ${animalBlock}
      ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
      ${feedBlocked && animalReady ? '<p class="slot-tool-hint">Pas assez de nourriture</p>' : ''}
    `;

    const onTap = () => {
      const liveProgress = game.getFarmLineProgress(buildingId, lineKey, unitIndex);
      const liveSlot = game.state.productionLines?.farm?.[buildingId]?.[lineKey]?.slots?.[unitIndex];
      if (liveSlot?.active) {
        if (liveProgress >= 1) {
          game.completeFarmLine(buildingId, lineKey, unitIndex);
        }
        return;
      }
      const liveMeta = game.getFarmMeta(buildingId);
      const liveAnimal = building.requiresAnimal ? liveMeta.animals?.[unitIndex] : null;
      const liveAnimalReady = !building.requiresAnimal || (!!liveAnimal && (liveAnimal.cyclesLeft || 0) > 0);
      const liveToolBlock = game.getFarmToolBlockReason(buildingId);
      const liveFeedId = liveMeta.feedId || getPrimaryFeedId(building);
      const liveFeedBlocked = needsFeed && (!liveFeedId || !canAffordFeed(building, liveFeedId, game.state));
      if (!liveAnimalReady || liveFeedBlocked || liveToolBlock) return;
      const result = game.startFarmSlot(buildingId, lineKey, unitIndex);
      if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
    };

    card.querySelector('.slot-visual-tap')?.addEventListener('click', onTap);
    card.querySelector('.slot-visual-tap')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap();
      }
    });
    return card;
  }

  const resource = game.resources[lineKey];
  card.innerHTML = `
    <div class="slot-visual"><span class="slot-visual-emoji">${resource?.emoji || building.emoji || '🏠'}</span></div>
    ${animalBlock}
    <div class="slot-footer">
      ${active ? `<div class="xp-bar-container slot-progress"><div class="xp-bar" style="width:${progressPct}%"></div></div>` : ''}
      ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}${canStart || canCollect ? ' affordable' : ''}" ${active && progress < 1 || (!active && blocked) ? 'disabled' : ''}>
        ${active ? (progress >= 1 ? 'Collecter' : getFarmBtnLabel(progress, remainingMs)) : 'Produire'}
      </button>
    </div>
  `;
  card.querySelector('.btn-start')?.addEventListener('click', () => {
    const liveProgress = game.getFarmLineProgress(buildingId, lineKey, unitIndex);
    const liveSlot = game.state.productionLines?.farm?.[buildingId]?.[lineKey]?.slots?.[unitIndex];
    if (liveSlot?.active) {
      if (liveProgress >= 1) game.completeFarmLine(buildingId, lineKey, unitIndex);
      return;
    }
    const result = game.startFarmSlot(buildingId, lineKey, unitIndex);
    if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
  });
  return card;
}

function buildUnifiedFarmSection(game, buildingId, building, container) {
  const lineKey = getUnifiedFarmLineKey(building);
  const line = game.state.productionLines?.farm?.[buildingId]?.[lineKey];
  if (!line) return;

  const productIds = Object.keys(building.products || {});
  const stockParts = productIds.map((id) => {
    const res = game.resources[id];
    return `${renderResourceIcon(res, 'tile-resource-icon') || ''}${res?.name || id} : ${game.state.inventory[id] || 0}`;
  });
  const cycleSec = Math.round((building.cycleMs || 10000) / 1000);
  const xpGain = applyMultiplierBonus(getFarmProductionXp(building), getPrestigeBonuses(game.state).jobXp)
    * getSeasonBoostMult(game.state);
  const xpBonusPct = getSeasonBonusPercents(game.state).jobXpPct;
  const xpBonusTag = xpBonusPct > 0
    ? `<span class="bonus-tag" title="Bonus XP métiers">+${xpBonusPct}%</span>`
    : '';
  const toolDur = getFarmToolDurabilityLabel(game, building);

  const section = document.createElement('div');
  section.className = 'production-line-section';
  section.dataset.building = buildingId;
  section.innerHTML = `
    <div class="production-line-head">
      <div class="production-line-title">
        ${getFarmBuildingIcon(buildingId) ? iconHtml(getFarmBuildingIcon(buildingId), 'tile-resource-icon', building.name) : `<span>${building.emoji || '🏠'}</span>`}
        <strong>${building.name}</strong>
        <span class="production-stock">${stockParts.join(' · ')}</span>
        ${toolDur ? `<span class="production-tool-dur">${toolDur}</span>` : ''}
      </div>
      <div class="production-line-meta">
        <span class="production-units">${line.units} emplacement${line.units > 1 ? 's' : ''}</span>
        <span class="production-harvest-time">${cycleSec}s/prod.${xpGain > 0 ? ` · +${formatNumber(xpGain)} XP${xpBonusTag}` : ''}</span>
      </div>
    </div>
    <div class="slots-grid production-units-grid"></div>
  `;

  const grid = section.querySelector('.production-units-grid');
  for (let i = 0; i < line.units; i++) {
    grid.appendChild(buildFarmUnitCard(game, buildingId, lineKey, i, building));
  }
  container.appendChild(section);
}

export function renderFarmProduction(game, el, buildingId) {
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;
  if (building.requiresAnimal) {
    ensureFarmUnitsForAnimalSlots(game.state, game.farmData, buildingId, game.balance);
  }
  const prog = getFarmBuildingProgress(game.state, buildingId, game.jobs, game.balance);
  const pct = prog.grantsXp ? (prog.xp / prog.needed) * 100 : 0;
  const meta = game.getFarmMeta(buildingId);
  const needsFeed = Object.keys(building.feed || {}).length > 0;
  const xpGain = applyMultiplierBonus(getFarmProductionXp(building), getPrestigeBonuses(game.state).jobXp)
    * getSeasonBoostMult(game.state);
  const xpBonusPct = getSeasonBonusPercents(game.state).jobXpPct;
  const xpBonusTag = xpBonusPct > 0
    ? `<span class="bonus-tag" title="Bonus XP métiers">+${xpBonusPct}%</span>`
    : '';
  const feedId = getPrimaryFeedId(building) || meta.feedId;
  if (needsFeed && feedId) {
    game.setFarmFeed(buildingId, feedId);
    meta.feedId = feedId;
  }
  const toolDur = getFarmToolDurabilityLabel(game, building);

  let feedHtml = '';
  if (needsFeed) {
    const cost = getFeedCost(building, feedId) || {};
    const entries = Object.entries(cost);
    const anyMissing = entries.some(([id, qty]) => (game.state.inventory[id] || 0) < qty);
    const stocks = entries.map(([id, qty]) => {
      const feedRes = game.resources[id];
      const have = game.state.inventory[id] || 0;
      const ok = have >= qty;
      return `
        <div class="farm-feed-stock-item${ok ? '' : ' missing'}">
          ${renderResourceIcon(feedRes, 'farm-feed-stock-icon') || feedRes?.emoji || ''}
          <strong class="farm-feed-stock-qty">${have}</strong>
          <span class="farm-feed-stock-hint">−${qty}</span>
        </div>`;
    }).join('');
    feedHtml = `
      <div class="farm-feed-stock-hero${anyMissing ? ' missing' : ''}">
        <span class="farm-feed-stock-label">Nourriture</span>
        <div class="farm-feed-stock-main">${stocks || '—'}</div>
        ${xpGain > 0 ? `<span class="farm-feed-stock-xp">+${formatNumber(xpGain)} XP${xpBonusTag}</span>` : ''}
      </div>`;
  } else if (!building.requiresAnimal) {
    feedHtml = xpGain > 0
      ? `<p class="farm-feed-preview">Gain : <strong>+${formatNumber(xpGain)} XP ${building.name}</strong>${xpBonusTag} / production</p>`
      : `<p class="farm-feed-preview">Le Puits fournit l’eau — <strong>pas d’XP</strong>.</p>`;
  }

  let animalHtml = '';
  if (building.requiresAnimal) {
    const animalName = building.animalName || 'Animal';
    const emptyIdx = getEmptyAnimalSlotIndex(meta);
    const nextUnlock = getNextAnimalSlotUnlock(building, meta);
    const slotDead = emptyIdx >= 0 && meta.animals[emptyIdx] && (meta.animals[emptyIdx].cyclesLeft || 0) <= 0;
    const buyCost = (slotDead && building.animalRepurchase) ? building.animalRepurchase : (building.animalPurchase || {});
    const buyParts = formatAnimalCostParts(buyCost, game.resources);
    const buyLabel = slotDead ? `Racheter ${animalName}` : `Acheter ${animalName}`;

    let unlockHtml = '';
    if (nextUnlock) {
      const needLv = nextUnlock.buildingLevel || 1;
      const lvOk = (prog.level || 1) >= needLv;
      const unlockParts = formatAnimalCostParts({ kirha: nextUnlock.kirha || 0, ...(nextUnlock.resources || {}) }, game.resources);
      unlockHtml = `
        <button type="button" class="btn btn-muted btn-sm btn-unlock-animal-slot" ${lvOk ? '' : 'disabled'}>
          Débloquer emplacement ${nextUnlock.slotIndex + 1} · Nv.${needLv}${lvOk ? '' : ` (actuel ${prog.level})`} · ${unlockParts.join(' + ')}
        </button>`;
    }

    if (emptyIdx >= 0 || unlockHtml) {
      animalHtml = `
        <div class="farm-animal-actions farm-animal-actions-top">
          ${emptyIdx >= 0 ? `<button type="button" class="btn btn-craft btn-buy-animal">${buyLabel} · ${buyParts.join(' + ')}</button>` : ''}
          ${unlockHtml}
        </div>`;
    }
  }

  el.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-title">${building.name}</div>
      <div class="skill-header-meta">${
        prog.grantsXp
          ? `Nv.${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}${toolDur ? ` · ${toolDur}` : ''}`
          : `Utilitaire${toolDur ? ` · ${toolDur}` : ''}`
      }</div>
      ${prog.grantsXp
        ? `<div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.atSeasonCap ? `Plafond Saison ${game.state.season || 1}` : `${prog.xp} / ${prog.needed} XP`}</p>`
        : ''}
    </div>
    <div class="panel-inner">
      ${feedHtml}
      ${animalHtml}
      <div id="farm-production-lines"></div>
    </div>
  `;

  el.querySelector('.btn-buy-animal')?.addEventListener('click', () => {
    const result = game.buyFarmAnimal(buildingId);
    if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
    else renderFarmProduction(game, el, buildingId);
  });
  el.querySelector('.btn-unlock-animal-slot')?.addEventListener('click', () => {
    const result = game.unlockFarmAnimalSlot(buildingId);
    if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
    else renderFarmProduction(game, el, buildingId);
  });

  const container = el.querySelector('#farm-production-lines');
  if (isUnifiedFarmBuilding(building)) {
    buildUnifiedFarmSection(game, buildingId, building, container);
    return;
  }

  // Puits / bâtiments simples : une ligne avec barre overlay
  for (const productId of getFarmProductionLineIds(building)) {
    const resource = game.resources[productId];
    const line = game.state.productionLines?.farm?.[buildingId]?.[productId];
    if (!line) continue;
    const section = document.createElement('div');
    section.className = 'production-line-section';
    section.innerHTML = `
      <div class="production-line-head">
        <div class="production-line-title">
          <strong>${resource?.name || productId}</strong>
          <span class="production-stock">Stock ${game.state.inventory[productId] || 0}</span>
          ${toolDur ? `<span class="production-tool-dur">${toolDur}</span>` : ''}
        </div>
      </div>
      <div class="farm-info-chips">
        ${xpGain > 0
          ? `<span class="farm-info-chip">📜 +${formatNumber(xpGain)} XP${xpBonusTag}</span>`
          : `<span class="farm-info-chip">Eau utilitaire · pas d’XP</span>`}
        <span class="farm-info-chip">${Math.round((building.cycleMs || 0) / 1000)}s / cycle</span>
      </div>
      <div class="slots-grid production-units-grid"></div>`;
    const grid = section.querySelector('.production-units-grid');
    for (let i = 0; i < line.units; i++) {
      grid.appendChild(buildFarmUnitCard(game, buildingId, productId, i, building));
    }
    container.appendChild(section);
  }
}

export function updateProductionLineProgresses(game, jobId) {
  const lines = game.state.productionLines?.harvest?.[jobId] || {};
  for (const [resourceId, line] of Object.entries(lines)) {
    line.slots.forEach((slot, unitIndex) => {
      if (!slot?.active) return;
      const progress = game.getLineHarvestProgress(jobId, resourceId, unitIndex);
      const card = document.querySelector(`.production-unit[data-job="${jobId}"][data-resource="${resourceId}"][data-unit="${unitIndex}"]`);
      if (!card) return;
      const pct = Math.floor(progress * 100);
      const fill = card.querySelector('.slot-progress-fill');
      const label = card.querySelector('.slot-progress-label');
      const phase = slot.active.phase;
      if (fill) fill.style.width = `${pct}%`;
      if (label) {
        label.textContent = phase === 'regrowing' && progress >= 1
          ? 'Prêt !'
          : getHarvestBtnLabel(phase, progress, getSlotRemainingMs(slot));
      }
      if (progress >= 1 && phase === 'regrowing') {
        card.classList.add('slot-can-harvest');
      }
      if (progress >= 1 && slot.active.phase === 'regrowing') {
        game.completeHarvestLine(jobId, resourceId, unitIndex);
      }
    });
  }
}

export function updateFarmLineProgresses(game, buildingId) {
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;

  const lineKeys = getFarmProductionLineIds(building);
  for (const lineKey of lineKeys) {
    const line = game.state.productionLines?.farm?.[buildingId]?.[lineKey];
    if (!line) continue;

    line.slots.forEach((slot, unitIndex) => {
      if (!slot?.active) return;
      const progress = game.getFarmLineProgress(buildingId, lineKey, unitIndex);
      const pct = Math.floor(progress * 100);
      let card = document.querySelector(`.production-unit[data-building="${buildingId}"][data-product="${lineKey}"][data-unit="${unitIndex}"]`);
      if (!card) return;

      if (isUnifiedFarmBuilding(building) || building.tapProgress) {
        let fill = card.querySelector('.slot-progress-fill');
        let label = card.querySelector('.slot-progress-label');
        if (!fill || !label) {
          patchFarmUnitCard(game, buildingId, lineKey, unitIndex);
          card = document.querySelector(`.production-unit[data-building="${buildingId}"][data-product="${lineKey}"][data-unit="${unitIndex}"]`);
          fill = card?.querySelector('.slot-progress-fill');
          label = card?.querySelector('.slot-progress-label');
        }
        const statusLabel = getFarmBtnLabel(progress, getSlotRemainingMs(slot));
        if (fill) fill.style.width = `${pct}%`;
        if (label) label.textContent = statusLabel;
        if (progress >= 1) {
          card?.classList.add('slot-can-harvest');
          const tap = card?.querySelector('.slot-visual-tap');
          if (tap) tap.setAttribute('aria-label', `${building.name} — Prêt !`);
          // Puits etc. : auto-collecte ; animaux unifiés : attendre le tap
          if (!isUnifiedFarmBuilding(building)) {
            game.completeFarmLine(buildingId, lineKey, unitIndex);
          }
        }
        return;
      }

      // Puits / bâtiments classiques : barre live comme la récolte
      let bar = card.querySelector('.slot-progress .xp-bar');
      const btn = card.querySelector('.btn-start');
      if (!bar && progress < 1) {
        patchFarmUnitCard(game, buildingId, lineKey, unitIndex);
        card = document.querySelector(`.production-unit[data-building="${buildingId}"][data-product="${lineKey}"][data-unit="${unitIndex}"]`);
        bar = card?.querySelector('.slot-progress .xp-bar');
      }
      if (bar) bar.style.width = `${pct}%`;
      if (btn) {
        if (progress >= 1) {
          btn.textContent = 'Collecter';
          btn.disabled = false;
          btn.classList.add('affordable');
        } else {
          btn.textContent = `Production ${pct}%`;
          btn.disabled = true;
        }
      }

      if (progress >= 1) {
        game.completeFarmLine(buildingId, lineKey, unitIndex);
      }
    });
  }
}

/** Reconstruit une carte unité ferme (barre live après démarrage). */
export function patchFarmUnitCard(game, buildingId, lineKey, unitIndex) {
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;
  const view = getFarmViewForBuilding(buildingId);
  if (getView() !== view) return;
  const old = document.querySelector(
    `.production-unit[data-building="${buildingId}"][data-product="${lineKey}"][data-unit="${unitIndex}"]`
  );
  if (!old) return;
  const fresh = buildFarmUnitCard(game, buildingId, lineKey, unitIndex, building);
  old.replaceWith(fresh);
}
