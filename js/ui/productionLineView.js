import { isResourceUnlockedByJob } from '../systems/zones.js';
import { getEffectiveRequiredJobLevel } from '../systems/progression.js';
import { getHarvestXp } from '../systems/harvest.js';
import { getResourceVisual, renderResourceIcon } from '../systems/resourceVisual.js';
import { canAffordFeed, getBuildingDef, listFeedOptions, FARM_BUILDING_LABELS } from '../systems/farm.js';
import { getFarmBuildingIcon, iconHtml } from '../core/assets.js';
import { emit } from '../core/events.js';
import { navigate, getFarmViewForBuilding, getHarvestViewForJob } from './router.js';
import { getVisibleHarvestViews, getVisibleFarmViews } from '../systems/careerChoice.js';

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
  const vis = getResourceVisual(resource, active ? (phase === 'regrowing' ? 'regrowing' : 'harvesting') : 'available');
  const spriteHtml = vis.sprite
    ? `<img class="slot-visual-sprite" src="${vis.sprite}" alt="" />`
    : `<span class="slot-visual-emoji">${vis.emoji || resource.emoji || '🌾'}</span>`;

  const card = document.createElement('div');
  card.className = `harvest-slot production-unit${active ? ' active-harvest' : ''}${canHarvest ? ' slot-can-harvest' : ''}`;
  card.dataset.job = jobId;
  card.dataset.resource = resourceId;
  card.dataset.unit = String(unitIndex);
  card.innerHTML = `
    <div class="slot-visual">${spriteHtml}</div>
    <div class="slot-footer">
      ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}${canHarvest ? ' affordable' : ''}" ${!canHarvest && active && progress < 1 ? 'disabled' : ''}>
        ${canHarvest ? 'Récolter !' : getHarvestBtnLabel(phase, progress)}
      </button>
    </div>
  `;
  card.querySelector('.btn-start')?.addEventListener('click', () => {
    if (canHarvest) game.startLineHarvest(jobId, resourceId, unitIndex);
    else if (active && progress >= 1 && phase === 'regrowing') {
      game.completeHarvestLine(jobId, resourceId, unitIndex);
    }
  });
  return card;
}

function buildHarvestLineSection(game, jobId, resourceId, resource, container) {
  const line = game.state.productionLines?.harvest?.[jobId]?.[resourceId];
  if (!line) return;
  const qty = game.state.inventory[resourceId] || 0;
  const maxUnits = game.balance.productionLines?.maxUnits ?? 10;
  const canBuy = game.canBuyHarvestSlot(jobId, resourceId);
  const preview = game.getLineUnitUnlockPreview(jobId, resourceId);

  const section = document.createElement('div');
  section.className = 'production-line-section';
  section.dataset.resource = resourceId;
  section.innerHTML = `
    <div class="production-line-head">
      <div class="production-line-title">
        ${renderResourceIcon(resource, 'tile-resource-icon')}
        <strong>${resource.name}</strong>
        <span class="production-stock">Stock : ${qty}</span>
      </div>
      <div class="production-line-meta">
        <span class="production-units">${line.units}/${maxUnits} unités</span>
        ${line.units < maxUnits ? `<button type="button" class="btn btn-small btn-upgrade btn-buy-unit" ${canBuy ? '' : 'disabled'}>+1 unité · ${formatNumber(preview.kirha ?? 0)} 💰</button>` : ''}
      </div>
    </div>
    <div class="slots-grid production-units-grid"></div>
  `;
  const grid = section.querySelector('.production-units-grid');
  for (let i = 0; i < line.units; i++) {
    grid.appendChild(buildLineUnitCard(game, jobId, resourceId, i, resource));
  }
  section.querySelector('.btn-buy-unit')?.addEventListener('click', () => {
    if (game.buyHarvestSlot(jobId, resourceId)) {
      renderJobProduction(game, container.parentElement || container, jobId);
    }
  });
  container.appendChild(section);
}

export function renderJobProduction(game, el, jobId) {
  const job = game.jobs[jobId];
  const prog = game.getJobProgress(jobId);
  const pct = (prog.xp / prog.needed) * 100;
  const resources = game.getAssignableResources(jobId);
  const unlocked = resources.filter((r) => isResourceUnlockedByJob(r, game.state, game.resources));
  const locked = resources.filter((r) => !isResourceUnlockedByJob(r, game.state, game.resources));
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
      <p class="view-desc">Chaque ressource a ses unités de production. Clique pour récolter, achète des unités pour produire en parallèle.</p>
      <div id="production-lines"></div>
    </div>
    ${locked.length ? `<div class="panel-inner panel-muted"><h3>Ressources verrouillées</h3><div class="resource-grid" id="locked-resources"></div></div>` : ''}
  `;

  el.querySelector('#job-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#job-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });

  const linesEl = el.querySelector('#production-lines');
  for (const resource of unlocked) {
    buildHarvestLineSection(game, jobId, resource.id, resource, linesEl);
  }

  const lockedEl = el.querySelector('#locked-resources');
  if (lockedEl) {
    for (const resource of locked) {
      const req = getEffectiveRequiredJobLevel(resource, game.resources);
      const tile = document.createElement('div');
      tile.className = 'resource-tile locked-res';
      tile.innerHTML = `<div class="tile-name">${resource.name}</div><div class="tile-lock">🔒 ${job.name} Nv.${req}</div>`;
      lockedEl.appendChild(tile);
    }
  }
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
      const btn = card.querySelector('.btn-start');
      if (btn) {
        btn.textContent = getHarvestBtnLabel(slot.active.phase, progress);
        btn.disabled = progress < 1 && slot.active.phase !== 'harvesting' ? false : progress < 1;
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
