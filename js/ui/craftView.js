/**
 * Interface atelier — rendu + clic (délégation unique).
 */
import { listWorkshopRecipes, inspectRecipe } from '../systems/crafting.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';
import { getCombatItemPreview, renderCraftDurabilityInfo } from '../systems/equipmentDisplay.js';
import { isRecipeEquipped } from '../systems/equipment.js';
import { emit } from '../core/events.js';
import { navigate } from './router.js';

function renderIngredientLine(ingredients, kirhaCost, kirhaHave) {
  const parts = ingredients.map(({ res, need, have, ok }) => {
    const icon = res ? renderResourceIcon(res, 'ing-icon') : '?';
    const combatCls = res?.combatOnly ? ' ing-combat' : '';
    return `<span class="${ok ? 'ing-ok' : 'ing-missing'}${combatCls}">${icon || ''} ${have}/${need}</span>`;
  });
  if (kirhaCost > 0) {
    const ok = kirhaHave >= kirhaCost;
    parts.push(`<span class="${ok ? 'ing-ok' : 'ing-missing'}">💰 ${kirhaHave}/${kirhaCost}</span>`);
  }
  return parts.join(' ');
}

function renderRecipeCard(game, info) {
  const { recipeId, recipe, locked, owned, broken, canMake, blockReason, buttonLabel, ingredients, kirhaCost, kirhaHave, jobXp, craftJob } = info;

  let statusHtml = '';
  if (locked) {
    const jobName = game.jobs[craftJob]?.name || 'Métier';
    statusHtml = `<p class="tile-lock">🔒 ${jobName} Nv.${info.required} requis</p>`;
  } else if (owned) {
    statusHtml = '<p class="tile-lock">✓ Déjà en service</p>';
  } else if (broken) {
    statusHtml = '<p class="tile-lock tile-lock-broken">🔧 Outil usé — refabriquer pour réparer</p>';
  } else if (blockReason) {
    const icon = blockReason.includes('💰') ? '💰' : blockReason.includes('Nv.') ? '🔒' : '📦';
    statusHtml = `<p class="tile-lock tile-lock-ing">${icon} ${blockReason}</p>`;
  }

  let combatHtml = '';
  if (recipe.combatItem) {
    const preview = getCombatItemPreview(recipe.combatItem, game.combatEquipment.items, game.weaponRoles);
    if (preview) {
      combatHtml = `
        <div class="craft-combat-preview">
          <div class="tile-stats">Nv.${preview.level} · ${preview.statsLine}</div>
        </div>
      `;
    }
  }

  const durabilityHtml = renderCraftDurabilityInfo(game.state, recipeId, recipe, {
    owned: owned && !broken,
    broken,
  });

  const xpLine = jobXp > 0
    ? `<div class="tile-stats">+${jobXp} XP ${game.jobs[craftJob]?.name || ''}</div>`
    : '';

  const canClick = canMake && !locked;
  const btnClass = canClick ? 'btn btn-craft affordable' : 'btn btn-craft craft-blocked';

  let equipBtn = '';
  if (owned && !broken && game.equipment.equipable[recipeId] && !isRecipeEquipped(game.state, recipeId)) {
    equipBtn = `<button type="button" class="btn btn-small btn-muted" data-equip-recipe="${recipeId}">Équiper</button>`;
  }

  return `
    <div class="craft-tile${canClick ? ' affordable' : ''}${locked ? ' locked-res' : ''}${owned ? ' craft-owned' : ''}${broken ? ' craft-broken' : ''}" data-recipe-id="${recipeId}">
      <div class="tile-name">${recipe.emoji} ${recipe.name}${recipe.repeatable ? ' ♻️' : ''}</div>
      <p class="tile-stats">${recipe.description || ''}</p>
      ${durabilityHtml}
      ${combatHtml}
      ${statusHtml}
      <div class="ingredients">${renderIngredientLine(ingredients, kirhaCost, kirhaHave)}</div>
      ${xpLine}
      <button type="button" class="${btnClass}" data-craft-recipe="${recipeId}" ${canClick ? '' : 'aria-disabled="true"'}>${buttonLabel}</button>
      ${equipBtn}
    </div>
  `;
}

function renderRecipeGroup(title, items, game) {
  if (!items.length) return '';
  const cards = items.map((info) => renderRecipeCard(game, info)).join('');
  return `
    <div class="craft-section-title">${title}</div>
    <div class="craft-grid">${cards}</div>
  `;
}

function handleCraftPanelClick(game, event, craftJobId, panelEl, headerEl) {
  const equipBtn = event.target.closest('[data-equip-recipe]');
  if (equipBtn) {
    event.preventDefault();
    game.doEquip(equipBtn.dataset.equipRecipe);
    paintCraftPanel(game, craftJobId, panelEl, headerEl);
    return;
  }

  const craftBtn = event.target.closest('[data-craft-recipe]');
  if (!craftBtn) return;

  event.preventDefault();
  event.stopPropagation();

  const recipeId = craftBtn.dataset.craftRecipe;
  const result = game.craftItem(recipeId);

  if (result.ok) {
    paintCraftPanel(game, craftJobId, panelEl, headerEl);
    return;
  }

  const message = result.error || 'Fabrication impossible.';
  emit('craftBlocked', { recipeId, message });
}

function paintCraftHeader(game, craftJobId, headerEl) {
  const job = game.jobs[craftJobId];
  const prog = game.getJobProgress(craftJobId);
  const pct = prog.needed > 0 ? (prog.xp / prog.needed) * 100 : 0;

  headerEl.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-title">${job?.emoji || '🔨'} ${job?.name || 'Atelier'}</div>
      <div class="skill-header-meta">Niveau ${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}${prog.atSeasonCap ? ' · plafond saison' : ''}</div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.xp} / ${prog.needed} XP</p>
    </div>
  `;
}

function paintCraftPanel(game, craftJobId, panelEl, headerEl) {
  paintCraftHeader(game, craftJobId, headerEl);

  const isTools = craftJobId === 'toolmaker';
  const isCook = craftJobId === 'cook';
  const groups = listWorkshopRecipes(craftJobId, game.getCraftContext());

  let hints = '';
  if (!isTools && !isCook) {
    hints = `
      <div class="merchant-hint panel-inner">
        <span>📜 Les fabrications avancées requièrent des <strong>Parchemins des Anciens</strong>.</span>
        <button type="button" class="btn btn-muted btn-sm" id="goto-auction">🏛️ Hôtel des Ventes</button>
      </div>
    `;
  } else if (isCook) {
    hints = `
      <div class="merchant-hint panel-inner cuisine-hint">
        <span>🍲 Les plats consommables donnent des bonus en donjon. Équipe ton tablier sur Perso si tu en as un.</span>
      </div>
    `;
  }

  const body = [
    renderRecipeGroup('✅ Disponibles', groups.available, game),
    renderRecipeGroup('📦 Possédé', groups.owned, game),
    renderRecipeGroup('🔒 Verrouillées', groups.locked, game),
  ].filter(Boolean).join('');

  panelEl.innerHTML = `
    ${hints}
    <div class="panel-inner craft-panels-root">
      ${body || '<p class="empty-text">Aucune recette pour cet atelier.</p>'}
    </div>
  `;

  panelEl.querySelector('#goto-auction')?.addEventListener('click', () => navigate('auction_house'));
}

/**
 * Monte l'atelier dans un conteneur.
 * @param {object} game
 * @param {HTMLElement} mountEl — élément racine (#workshop-content ou #cuisine-content)
 * @param {string} craftJobId
 */
export function mountCraftWorkshop(game, mountEl, craftJobId) {
  mountEl.innerHTML = '<div class="craft-header"></div><div class="craft-body"></div>';
  const headerEl = mountEl.querySelector('.craft-header');
  const panelEl = mountEl.querySelector('.craft-body');

  paintCraftPanel(game, craftJobId, panelEl, headerEl);

  mountEl.onclick = (event) => {
    handleCraftPanelClick(game, event, craftJobId, panelEl, headerEl);
  };
}

/** Rafraîchit l'atelier si la vue est ouverte (appelé après stateChange). */
export function refreshCraftWorkshopIfMounted(game, mountEl, craftJobId) {
  if (!mountEl?.querySelector('.craft-body')) return;
  const headerEl = mountEl.querySelector('.craft-header');
  const panelEl = mountEl.querySelector('.craft-body');
  paintCraftPanel(game, craftJobId, panelEl, headerEl);
}

export { inspectRecipe };
