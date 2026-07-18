import { getResourceVisual, renderResourceIcon } from '../systems/resourceVisual.js';
import { canAffordFeed, getBuildingDef, listFeedOptions, FARM_BUILDING_LABELS } from '../systems/farm.js';
import { getFarmBuildingIcon, getJobIcon, iconHtml } from '../core/assets.js';
import { getVisibleProductionResources } from '../systems/productionLines.js';
import { getHarvestXp, getHarvestTime } from '../systems/harvest.js';
import { getHarvestXpForResource } from '../systems/progression.js';
import { getHarvestToolCheck } from '../systems/toolTier.js';
import { getToolUsesRemaining, isDurabilityTool } from '../systems/toolDurability.js';
import { getJobEquippedTool } from '../systems/equipment.js';

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toLocaleString('fr-FR');
}

function getHarvestBtnLabel(phase, progress = 0) {
  const pct = Math.floor(progress * 100);
  if (phase === 'harvesting') return `Récolte ${pct}%`;
  if (phase === 'regrowing') return `Repousse ${pct}%`;
  return 'Récolter';
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

  const progressPct = Math.floor(progress * 100);
  const statusLabel = active
    ? (phase === 'regrowing' && progress >= 1 ? 'Prêt !' : getHarvestBtnLabel(phase, progress))
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

function buildHarvestLineSection(game, jobId, resourceId, resource, container) {
  const line = game.state.productionLines?.harvest?.[jobId]?.[resourceId];
  if (!line) return;
  const qty = game.state.inventory[resourceId] || 0;
  const maxUnits = game.balance.productionLines?.maxUnitsPerResource ?? 5;
  const xpPerHarvest = getHarvestXpForResource(resource, game.resources, game.balance);
  const harvestMs = Math.round(getHarvestTime(resource, game.state, game.jobs, game.balance, game.resources) / 1000);
  const toolDurability = getLineToolDurability(game, jobId, resource);

  const section = document.createElement('div');
  section.className = 'production-line-section';
  section.dataset.resource = resourceId;
  section.innerHTML = `
    <div class="production-line-head">
      <div class="production-line-title">
        ${renderResourceIcon(resource, 'tile-resource-icon')}
        <strong>${resource.name}</strong>
        <span class="production-stock">Stock : ${qty}</span>
        <span class="production-xp">+${xpPerHarvest} XP</span>
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

function buildJobUnlockBanner(game) {
  const upcoming = getUpcomingGatheringJobUnlocks(game.state, game.balance, game.jobs, 3);
  if (!upcoming.length) return null;

  const panel = document.createElement('div');
  panel.className = 'job-unlock-banner';
  panel.innerHTML = '<h4 class="job-unlock-banner-title">Prochains métiers</h4>';

  for (const entry of upcoming) {
    const pct = Math.floor(entry.progress * 100);
    const gateName = game.jobs[entry.gateJob]?.name || entry.gateJob;
    const icon = getJobIcon(entry.jobId);
    const row = document.createElement('div');
    row.className = `job-unlock-row${entry.ready ? ' job-unlock-ready' : ''}`;
    row.innerHTML = `
      <div class="job-unlock-row-head">
        <span class="job-unlock-icon">${icon ? iconHtml(icon, 'job-unlock-img', entry.label) : entry.emoji}</span>
        <div class="job-unlock-info">
          <strong>${entry.label}</strong>
          <span class="job-unlock-req">${entry.ready ? 'Débloqué !' : `${gateName} Nv.${entry.currentLevel} / ${entry.requiredLevel}`}</span>
        </div>
        <span class="job-unlock-pct">${pct}%</span>
      </div>
      <div class="xp-bar-container job-unlock-bar"><div class="xp-bar" style="width:${pct}%"></div></div>
      ${entry.hint && !entry.ready ? `<p class="job-unlock-hint">${entry.hint}</p>` : ''}
    `;
    panel.appendChild(row);
  }

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
      <div id="job-unlock-banner"></div>
      <h3>Lignes de production</h3>
      <p class="view-desc">La première ressource est offerte. Débloque jusqu'à 5 unités, puis passe à la ressource suivante quand ton niveau le permet.</p>
      <div id="production-lines"></div>
      <div id="production-unlock"></div>
    </div>
  `;

  el.querySelector('#job-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#job-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });

  const bannerSlot = el.querySelector('#job-unlock-banner');
  const banner = buildJobUnlockBanner(game);
  if (bannerSlot && banner) bannerSlot.appendChild(banner);
  else if (bannerSlot) bannerSlot.remove();

  const linesEl = el.querySelector('#production-lines');
  for (const resource of unlocked) {
    buildHarvestLineSection(game, jobId, resource.id, resource, linesEl);
  }

  const unlockEl = el.querySelector('#production-unlock');
  if (unlockEl) unlockEl.appendChild(buildUnlockPanel(game, jobId));
}

function buildFarmUnitCard(game, buildingId, productId, unitIndex, building, resource) {
  const progress = game.getFarmLineProgress(buildingId, productId, unitIndex);
  const line = game.state.productionLines?.farm?.[buildingId]?.[productId];
  const slot = line?.slots?.[unitIndex];
  const active = !!slot?.active;
  const meta = game.getFarmMeta(buildingId);
  const needsAnimal = building.requiresAnimal && !meta.hasAnimal;
  const toolBlock = game.getFarmToolBlockReason(buildingId);
  const needsFeed = Object.keys(building.feed || {}).length > 0;
  const feedBlocked = needsFeed && (!meta.feedId || !canAffordFeed(building, meta.feedId, game.state));
  const blocked = needsAnimal || feedBlocked || toolBlock;
  const canStart = !active && !blocked;

  const card = document.createElement('div');
  card.className = `farm-slot harvest-slot production-unit${active ? ' active-harvest' : ''}`;
  card.dataset.building = buildingId;
  card.dataset.product = productId;
  card.dataset.unit = String(unitIndex);
  card.innerHTML = `
    <div class="slot-visual"><span class="slot-visual-emoji">${resource?.emoji || building.emoji || '🏠'}</span></div>
    <div class="slot-footer">
      ${active ? `<div class="xp-bar-container slot-progress"><div class="xp-bar" style="width:${Math.floor(progress * 100)}%"></div></div>` : ''}
      ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}${canStart || (active && progress >= 1) ? ' affordable' : ''}" ${active && progress < 1 || (!active && blocked) ? 'disabled' : ''}>
        ${active ? (progress >= 1 ? 'Collecter' : `Production ${Math.floor(progress * 100)}%`) : 'Produire'}
      </button>
    </div>
  `;
  card.querySelector('.btn-start')?.addEventListener('click', () => {
    if (canStart) {
      const result = game.startFarmSlot(buildingId, productId, unitIndex);
      if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
    } else if (active && progress >= 1) {
      game.completeFarmLine(buildingId, productId, unitIndex);
    }
  });
  return card;
}

export function renderFarmProduction(game, el, buildingId) {
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;
  const prog = game.getJobProgress('breeder');
  const pct = (prog.xp / prog.needed) * 100;
  const meta = game.getFarmMeta(buildingId);
  const productIds = Object.keys(building.products || {});
  const visibleFarmViews = getVisibleFarmViews(game.state, game.balance);
  const currentView = getFarmViewForBuilding(buildingId);
  const prevView = getAdjacentVisibleView(currentView, visibleFarmViews, -1);
  const nextView = getAdjacentVisibleView(currentView, visibleFarmViews, 1);
  const needsFeed = Object.keys(building.feed || {}).length > 0;
  const feedOptions = listFeedOptions(building);

  let feedHtml = '';
  if (needsFeed) {
    feedHtml = `<label>Ration <select class="farm-feed-select" id="farm-feed-select">
      <option value="">— Choisir —</option>
      ${feedOptions.map((id) => `<option value="${id}" ${meta.feedId === id ? 'selected' : ''}>${game.resources[id]?.name || id}</option>`).join('')}
    </select></label>`;
  }

  let animalHtml = '';
  if (building.requiresAnimal && !meta.hasAnimal && building.animalPurchase) {
    const cost = building.animalPurchase;
    animalHtml = `<button type="button" class="btn btn-craft btn-buy-animal">Acheter animal · ${cost.kirha || 0} 💰</button>`;
  }

  el.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-title">${building.name}</div>
      <div class="skill-header-meta">Éleveur Nv.${prog.level}</div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
    </div>
    <div class="panel-inner">
      ${animalHtml}
      ${feedHtml}
      <div id="farm-production-lines"></div>
    </div>
  `;

  el.querySelector('#farm-feed-select')?.addEventListener('change', (e) => {
    game.setFarmFeed(buildingId, e.target.value);
  });
  el.querySelector('.btn-buy-animal')?.addEventListener('click', () => {
    const result = game.buyFarmAnimal(buildingId);
    if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
    else renderFarmProduction(game, el, buildingId);
  });

  const container = el.querySelector('#farm-production-lines');
  for (const productId of productIds) {
    const resource = game.resources[productId];
    const line = game.state.productionLines?.farm?.[buildingId]?.[productId];
    if (!line) continue;
    const section = document.createElement('div');
    section.className = 'production-line-section';
    section.innerHTML = `<div class="production-line-head"><strong>${resource?.name || productId}</strong> · Stock ${game.state.inventory[productId] || 0} · ${line.units} unité(s)</div><div class="slots-grid"></div>`;
    const grid = section.querySelector('.slots-grid');
    for (let i = 0; i < line.units; i++) {
      grid.appendChild(buildFarmUnitCard(game, buildingId, productId, i, building, resource));
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
          : getHarvestBtnLabel(phase, progress);
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
  const lines = game.state.productionLines?.farm?.[buildingId] || {};
  for (const [productId, line] of Object.entries(lines)) {
    line.slots.forEach((slot, unitIndex) => {
      if (!slot?.active) return;
      const progress = game.getFarmLineProgress(buildingId, productId, unitIndex);
      if (progress >= 1) {
        game.completeFarmLine(buildingId, productId, unitIndex);
      }
    });
  }
}
