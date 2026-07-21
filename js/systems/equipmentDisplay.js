import {
  isDurabilityTool,
  formatDurabilityLabel,
  getEffectiveMaxUses,
} from './toolDurability.js';

const ZONE_ITEM_LEVEL = {
  village_sakura: 1,
  petal_forest: 2,
  mist_river: 3,
  jade_mountains: 4,
  lotus_sanctuary: 5,
};

export function getItemLevel(item) {
  if (!item) return 1;
  if (item.itemLevel != null) return item.itemLevel;
  return ZONE_ITEM_LEVEL[item.zone] ?? 1;
}

export function formatItemStats(stats) {
  if (!stats) return '';
  const parts = [];
  if (stats.hp) parts.push(`+${stats.hp} HP`);
  if (stats.atk) parts.push(`+${stats.atk} ATK`);
  if (stats.def) parts.push(`+${stats.def} DEF`);
  return parts.join(' · ') || '—';
}

export function getWeaponRolePreview(item, weaponRoles) {
  if (!item?.weaponType || !weaponRoles) return null;
  return weaponRoles[item.weaponType] || null;
}

export function renderDurabilityBar(state, recipeId, recipe) {
  if (!isDurabilityTool(recipe)) return '';
  const remaining = state.toolDurability?.[recipeId];
  const max = getEffectiveMaxUses(state, recipe) || recipe.maxUses;
  const pct = remaining === undefined ? 100 : Math.max(0, (remaining / max) * 100);
  const broken = remaining !== undefined && remaining <= 0;
  const warnClass = !broken && pct <= 25 ? ' durability-low' : '';
  const brokenClass = broken ? ' durability-broken' : '';
  const label = formatDurabilityLabel(state, recipeId, recipe);
  return `
    <div class="durability-bar-wrap${brokenClass}${warnClass}" title="${label}">
      <div class="durability-bar"><div class="durability-fill" style="width:${pct}%"></div></div>
      <span class="durability-label">${label}</span>
    </div>
  `;
}

/** Affichage durabilité au craft (avant possession) ou barre si déjà possédé. */
export function renderCraftDurabilityInfo(state, recipeId, recipe, { owned = false, broken = false } = {}) {
  if (!isDurabilityTool(recipe)) return '';
  if (owned || broken) return renderDurabilityBar(state, recipeId, recipe);
  return `<p class="tile-stats craft-durability-hint">🔧 ${recipe.maxUses} utilisations — s'use à chaque emploi</p>`;
}

export function renderEquippedToolRow(state, recipeId, recipes, slotLabel = 'Outil') {
  const recipe = recipes[recipeId];
  if (!recipe) return '';
  const dur = isDurabilityTool(recipe) ? renderDurabilityBar(state, recipeId, recipe) : '';
  return `
    <div class="job-tool-row">
      <div class="job-tool-row-head">
        <span class="job-tool-slot">${slotLabel}</span>
        <strong>${recipe.emoji} ${recipe.name}</strong>
      </div>
      ${dur}
    </div>
  `;
}

export function renderDQStatsBlock(breakdown, charProg, { compact = false } = {}) {
  const { total, base, equipment, setBonus } = breakdown;
  const setLine = setBonus.hp || setBonus.atk || setBonus.def
    ? ` · Set : +${setBonus.hp} / +${setBonus.atk} / +${setBonus.def}`
    : '';
  return `
    <div class="dq-stats${compact ? ' dq-stats-compact' : ''}">
      <div class="dq-stat"><span class="dq-stat-val">${total.hp}</span><span class="dq-stat-lbl">PV</span></div>
      <div class="dq-stat"><span class="dq-stat-val">${total.atk}</span><span class="dq-stat-lbl">ATQ</span></div>
      <div class="dq-stat"><span class="dq-stat-val">${total.def}</span><span class="dq-stat-lbl">DEF</span></div>
    </div>
    <p class="dq-stats-detail">Base Nv.${charProg.level} : ${base.hp} / ${base.atk} / ${base.def} · Équip. : +${equipment.hp} / +${equipment.atk} / +${equipment.def}${setLine}</p>
  `;
}

export function getCombatItemPreview(itemId, combatItems, weaponRoles) {
  const item = combatItems[itemId];
  if (!item) return null;
  const role = getWeaponRolePreview(item, weaponRoles);
  return {
    item,
    level: getItemLevel(item),
    statsLine: formatItemStats(item.stats),
    roleLabel: role?.label || item.className || null,
    roleShort: role?.role || null,
    roleDescription: role?.description || null,
  };
}
