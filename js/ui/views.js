import { resolveItem, getSkillTargetMode, getLivingEnemies, getActiveEnemy } from '../systems/combat.js';
import {
  canCraft,
  getCraftBlockReason,
  getCraftSellBonus,
  getRecipeCraftJob,
  getRecipeRequiredLevel,
  getRecipeJobXp,
} from '../systems/craft.js';
import { isResourceUnlockedByJob } from '../systems/zones.js';
import { getEquippedLabel, getOwnedGatheringEquipment, isRecipeEquipped, recipeBelongsToWorkshopTab } from '../systems/equipment.js';
import { formatOfflineDuration } from '../systems/offline.js';
import { navigate, VIEWS, JOB_VIEW_MAP, getCraftJobFromView, CRAFT_NAV, getAdjacentHarvestView, getHarvestViewForJob, getAdjacentFarmView, getFarmViewForBuilding, isFarmView } from './router.js';
import { renderTutorialOverlay, scheduleTutorialOverlayRefresh } from './tutorialUi.js';
import { getHarvestTime, getRegrowthTime, getHarvestYield } from '../systems/harvest.js';
import { getResourceVisual, getSlotVisualDisplay, renderResourceIcon, getResourceIcon } from '../systems/resourceVisual.js';
import { getJobIcon, getNavIcon, getFarmBuildingIcon, getFarmProductIcon, UI, iconHtml } from '../core/assets.js';
import { getQuestStatusText, isQuestCompleted, isQuestAvailable, isQuestReady, QUEST_CHAPTER_LABELS } from '../systems/quests.js';
import { isTutorialActive } from '../systems/tutorial.js';
import { applyCombatTutorialFocus, clearCombatTutorialFocus } from './tutorialUi.js';
import { getCombatItemPreview, getItemLevel, getWeaponRolePreview, renderDurabilityBar, renderCraftDurabilityInfo, renderEquippedToolRow, renderDQStatsBlock } from '../systems/equipmentDisplay.js';
import { hasWorkingTool, isDurabilityTool, isToolBroken } from '../systems/toolDurability.js';
import { emit } from '../core/events.js';
import { FARM_BUILDING_IDS, canAffordFeed, getBuildingDef, getFeedCost, listFeedOptions, FARM_BUILDING_LABELS } from '../systems/farm.js';
import { getMealEffect, MEAL_EFFECTS } from '../systems/consumables.js';

let workshopTab = 'toolmaker';
let charTab = 'equipment';
let combatUi = { step: 'action', menu: 'main', pendingSkill: null, targetMode: null };

export function resetCombatUi() {
  combatUi = { step: 'action', menu: 'main', pendingSkill: null, targetMode: null };
}

function resetCombatUiTurn() {
  combatUi = { step: 'action', menu: 'main', pendingSkill: null, targetMode: null };
}

function getTutorialDungeonCombatHint(combatUi, { canAct, isPlayerTurn, targetMode }) {
  if (!isPlayerTurn) {
    return {
      step: 0,
      text: 'Patiente — l\'ennemi attaque, puis ce sera ton tour.',
      selector: null,
      finger: null,
    };
  }
  if (combatUi.step === 'target' && targetMode === 'enemy') {
    return {
      step: 3,
      text: '③ Touche l\'ennemi (👻) pour lancer ton attaque.',
      selector: '.dq-enemies-group .dq-enemy-card.dq-targetable',
      finger: '👆 VISE L\'ENNEMI',
    };
  }
  if (combatUi.menu === 'attack' && canAct) {
    return {
      step: 2,
      text: '② Choisis une attaque (par ex. Frappe).',
      selector: '.dq-command-menu [data-skill]',
      finger: '👆 CHOISIR',
    };
  }
  if (canAct && combatUi.menu === 'main' && combatUi.step === 'action') {
    return {
      step: 1,
      text: '① Ton tour ! Touche « Attaquer ».',
      selector: '.dq-command-menu [data-menu="attack"]',
      finger: '👆 ATTAQUER',
    };
  }
  if (combatUi.menu === 'spells' && canAct) {
    return {
      step: 1,
      text: 'Pour l\'instant, utilise « Attaquer ». Touche « Retour ».',
      selector: '.dq-command-menu [data-menu="main"]',
      finger: '👆 RETOUR',
    };
  }
  return null;
}

const SET_LABELS = { sakura: 'Sakura', petal: 'Pétale', jade: 'Jade' };

function navigateObjective(game, objective) {
  if (!objective) return;
  if (objective.hintView) {
    navigate(objective.hintView === 'workshop' ? 'workshop' : objective.hintView);
  } else if (objective.hintJob) {
    navigate(JOB_VIEW_MAP[objective.hintJob] || 'world');
  }
}

function renderObjectiveBanner(game, container, { ready = false } = {}) {
  if (!container || isTutorialActive(game.state)) return;
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
  if (!container || !game.shouldShowPrestigeTeaser() || isTutorialActive(game.state)) {
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
  const attacks = skills.filter((s) => s.damage);
  const spells = skills.filter((s) => !s.damage && (s.heal || s.effect));
  return { attacks, spells };
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
    missions: renderMissions,
    world: renderWorld,
    job_lumberjack: () => renderJob(game, container, 'lumberjack'),
    job_fisher: () => renderJob(game, container, 'fisher'),
    job_miner: () => renderJob(game, container, 'miner'),
    job_farmer: () => renderJob(game, container, 'farmer'),
    job_alchemist: () => renderJob(game, container, 'alchemist'),
    inventory: renderInventory,
    auction_house: renderAuctionHouse,
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

/* ── Minibar droite (métiers actifs) ── */
function renderMinibarEquipBlock(emoji, recipeId, state, recipes) {
  if (!recipeId) return `<div class="minibar-equip">${emoji} —</div>`;
  const recipe = recipes[recipeId];
  const label = getEquippedLabel(recipeId, recipes) || '—';
  const dur = recipe && isDurabilityTool(recipe) ? renderDurabilityBar(state, recipeId, recipe) : '';
  return `<div class="minibar-equip-block"><div class="minibar-equip">${emoji} ${label}</div>${dur}</div>`;
}

export function renderMinibar(game, el, viewId, opts = {}) {
  if (!el) return;

  const jobId = viewId.startsWith('job_') ? viewId.replace('job_', '') : null;
  const craftJobId = viewId === 'cuisine' ? 'cook' : getCraftJobFromView(viewId);
  const farmBuildingId = isFarmView(viewId) ? viewId.slice(5) : null;

  if (!jobId && !craftJobId && !farmBuildingId) {
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  if (opts.collapsed) el.classList.add('collapsed');
  else el.classList.remove('collapsed');

  const activeJobId = jobId || craftJobId || 'breeder';
  const job = game.jobs[activeJobId];
  const prog = game.getJobProgress(activeJobId);

  let equipHtml = '';
  if (jobId) {
    const toolId = game.state.equipment?.jobs?.[jobId];
    const accId = game.state.equipment?.accessories?.[jobId];
    equipHtml += renderMinibarEquipBlock('🛠️', toolId, game.state, game.recipes);
    if (accId) equipHtml += renderMinibarEquipBlock('🧰', accId, game.state, game.recipes);
  } else if (farmBuildingId) {
    const toolId = game.state.equipment?.jobs?.breeder;
    equipHtml += renderMinibarEquipBlock('🪣', toolId, game.state, game.recipes);
  } else {
    const globalTool = game.state.equipment?.global;
    if (globalTool) equipHtml += renderMinibarEquipBlock('🧰', globalTool, game.state, game.recipes);
    if (!equipHtml) equipHtml = '<div class="minibar-equip">—</div>';
  }

  let milestonesHtml = '';
  if (jobId) {
    const allJobRes = Object.values(game.resources)
      .filter((r) => r.job === jobId && !r.craftOnly && !r.combatOnly)
      .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1));

    for (const res of allJobRes) {
      const done = prog.level >= (res.requiredJobLevel || 1);
      const zone = game.balance.zones[res.zone];
      milestonesHtml += `
        <div class="minibar-milestone${done ? ' done' : ''}">
          ${done ? '✓' : '○'} ${renderResourceIcon(res, 'minibar-res-icon')}${res.name} — Nv.${res.requiredJobLevel}
          ${zone ? `<br><small>${zone.name}</small>` : ''}
        </div>
      `;
    }
  } else if (craftJobId) {
    for (const [, recipe] of Object.entries(game.recipes)) {
      if (recipe.craftJob !== craftJobId) continue;
      const req = getRecipeRequiredLevel(recipe);
      const done = prog.level >= req;
      milestonesHtml += `
        <div class="minibar-milestone${done ? ' done' : ''}">
          ${done ? '✓' : '○'} ${recipe.emoji} ${recipe.name} — Nv.${req}
        </div>
      `;
    }
  }

  el.innerHTML = `
    <button class="minibar-toggle" type="button" title="Réduire">${opts.collapsed ? '◀' : '▶'}</button>
    <div class="minibar-body">
      <div class="minibar-section">
        <h4>${job?.icon ? iconHtml(job.icon, 'minibar-job-icon', job.name) : (job?.emoji ? `${job.emoji} ` : '')}${job?.name || 'Métier'} Nv.${prog.level}</h4>
      </div>
      <div class="minibar-section">
        <h4>🛠️ Outils</h4>
        ${equipHtml}
      </div>
      <div class="minibar-section">
        <h4>🏆 Paliers</h4>
        ${milestonesHtml || '<p class="empty-text" style="padding:0">—</p>'}
      </div>
    </div>
  `;

  el.querySelector('.minibar-toggle')?.addEventListener('click', opts.onToggle);
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

function renderCharacter(game, el) {
  const s = game.state;
  const zone = game.getCurrentZone();
  const p = s.prestige || {};
  const charProg = game.getCharacterProgress();
  const charPct = (charProg.xp / charProg.needed) * 100;
  const displayName = game.getCharacterDisplayName();
  const nickInfo = game.getNicknameRenameInfo();
  const maxLen = game.characterConfig.nicknameMaxLength || 20;
  const statsBreakdown = game.getCharacterStatsBreakdown();
  const showObjective = !isTutorialActive(s);

  let nicknameHtml = '';
  if (!nickInfo.hasNickname) {
    nicknameHtml = `
      <div class="nickname-form">
        <label class="nickname-label" for="nickname-input">Choisis ton pseudo</label>
        <div class="nickname-row">
          <input id="nickname-input" class="nickname-input" type="text" maxlength="${maxLen}" placeholder="Ex. Kira le Bûcheron" />
          <button type="button" class="btn btn-small btn-craft" id="nickname-set">Valider</button>
        </div>
        <p class="nickname-hint">Gratuit une seule fois — ensuite renommage payant (1× / mois).</p>
      </div>
    `;
  } else {
    nicknameHtml = `
      <p class="nickname-hint">
        ${nickInfo.canRename
          ? `Renommage : ${formatNumber(nickInfo.cost)} 💰 (1× par mois)`
          : `Renommage dans ${nickInfo.daysUntilRename} jour(s) · ${formatNumber(nickInfo.cost)} 💰`}
      </p>
      ${nickInfo.canRename ? `
        <details class="nickname-rename-details">
          <summary class="nickname-rename-summary">Renommer mon personnage</summary>
          <div class="nickname-row">
            <input id="nickname-rename-input" class="nickname-input" type="text" maxlength="${maxLen}" placeholder="Nouveau pseudo" />
            <button type="button" class="btn btn-small btn-muted" id="nickname-rename">
              ${formatNumber(nickInfo.cost)} 💰
            </button>
          </div>
        </details>
      ` : ''}
    `;
  }

  const nextQuest = game.getNextQuest();
  const questReady = nextQuest && !isQuestCompleted(s, nextQuest.id) && isQuestReady(nextQuest, s, game.recipes);

  el.innerHTML = `
    ${showObjective ? '<div class="mission-current panel-inner objective-banner" id="char-objective"></div>' : ''}
    ${showObjective ? '<div class="panel-inner prestige-teaser" id="char-prestige-teaser"></div>' : ''}
    <div class="char-hero-card panel-inner">
      <div class="char-hero-row">
        <div class="char-portrait-wrap char-hero-portrait">
          <div class="char-portrait">${iconHtml(getNavIcon('character'), 'char-portrait-icon', 'Personnage')}</div>
        </div>
        <div class="char-hero-main">
          <h3 class="char-display-name">${displayName}</h3>
          ${nicknameHtml}
          <p class="view-desc">Saison ${s.season || 1} · ${zone?.emoji || ''} ${zone?.name || ''}</p>
          <div class="skill-header-meta">Personnage Nv.${charProg.level}${charProg.seasonCap ? ` / ${charProg.seasonCap}` : ''}</div>
          <div class="xp-bar-container"><div class="xp-bar" style="width:${charPct}%"></div></div>
          <p class="xp-text">${charProg.atSeasonCap ? `Plafond Saison ${s.season || 1} — passe à la suivante` : `${charProg.xp} / ${charProg.needed} XP`}</p>
          ${renderDQStatsBlock(statsBreakdown, charProg, { compact: true })}
          <div class="stat-row">Bonus saison : +${Math.round((p.kirhaBonus || 0) * 100)}% 💰 · +${Math.round((p.xpBonus || 0) * 100)}% XP</div>
          <button class="btn btn-muted btn-small" id="goto-combat" type="button">⚔️ Zones de combat</button>
        </div>
      </div>
    </div>
    <div class="char-tabs" role="tablist">
      <button type="button" class="char-tab-btn${charTab === 'equipment' ? ' active' : ''}" data-tab="equipment" role="tab">Équipement</button>
      <button type="button" class="char-tab-btn${charTab === 'stats' ? ' active' : ''}" data-tab="stats" role="tab">Stats</button>
      <button type="button" class="char-tab-btn${charTab === 'jobs' ? ' active' : ''}" data-tab="jobs" role="tab">Métiers</button>
      <button type="button" class="char-tab-btn${charTab === 'team' ? ' active' : ''}" data-tab="team" role="tab">Équipe</button>
    </div>
    <div class="panel-inner char-tab-panel" id="char-tab-panel"></div>
  `;

  if (showObjective) {
    renderObjectiveBanner(game, el.querySelector('#char-objective'), { ready: questReady });
    renderPrestigeTeaser(game, el.querySelector('#char-prestige-teaser'));
  }

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

  el.querySelectorAll('.char-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      charTab = btn.dataset.tab;
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
  if (charTab === 'equipment') renderCharEquipmentTab(game, panel);
  else if (charTab === 'stats') renderCharStatsTab(game, panel);
  else if (charTab === 'jobs') renderCharJobsTab(game, panel);
  else if (charTab === 'team') renderCharTeamTab(game, panel);
}

function appendGatheringToolRow(game, container, entry, { showUnequip = false, showEquip = false } = {}) {
  const s = game.state;
  const { recipeId, recipe, jobEmoji, jobName, slotKind, broken } = entry;
  const slotIcon = slotKind === 'accessory' ? '🧰' : '🛠️';
  const row = document.createElement('div');
  row.className = `char-tool-row${entry.equipped ? ' char-tool-equipped' : ''}${broken ? ' char-tool-broken' : ''}`;

  const main = document.createElement('div');
  main.className = 'char-tool-main';
  main.innerHTML = `
    <span class="char-tool-name">${recipe.emoji} ${recipe.name}</span>
    <span class="char-tool-meta">${slotIcon} ${jobEmoji} ${jobName}</span>
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
    const unequipKind = slotKind === 'global' ? 'global' : slotKind;
    const jobId = slotKind === 'global' ? 'global' : entry.jobId;
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

function renderCharEquipmentTab(game, panel) {
  const s = game.state;
  const tutorialUi = game.getTutorialUi();
  const openOwned = !!tutorialUi?.craftEquipPhase && charTab === 'equipment';
  panel.innerHTML = `
    <h3>⚔️ Équipement de combat</h3>
    <p class="view-desc">Ton arme définit ton rôle en combat. Touche un slot pour retirer.</p>
    <div class="combat-slots-grid slots-equipment" id="combat-slots"></div>
    <details class="char-owned-details"${openOwned ? ' open' : ''}>
      <summary>Pièces possédées</summary>
      <div id="combat-owned" class="equip-actions"></div>
    </details>
    <h3 class="char-subsection-title">🛠️ Outils</h3>
    <p class="view-desc char-tools-desc">Tous tes outils de métier au même endroit.</p>
    <div id="char-gather-equip"></div>
  `;

  const combatSlotsEl = panel.querySelector('#combat-slots');
  for (const slot of Object.values(game.combatEquipment.slots)) {
    if (slot.companionOnly) continue;
    const ref = s.combatEquipment?.[slot.id];
    const item = ref ? resolveItem(s, ref, game.combatEquipment.items) : null;
    const role = item?.weaponType ? getWeaponRolePreview(item, game.weaponRoles) : null;
    const roleLine = role ? `<div class="weapon-role-line">${role.label} · ${role.role}</div>` : '';
    const levelTag = item ? `<span class="item-level-tag">Nv.${getItemLevel(item)}</span>` : '';
    const weaponHighlight = item?.slot === 'weapon' ? ' combat-slot-weapon' : '';
    const card = document.createElement('div');
    card.className = `combat-slot-card${item ? ' filled' : ''}${weaponHighlight}`;
    card.dataset.combatSlot = slot.id;
    card.innerHTML = `
      <div>${slot.emoji} ${slot.name} ${levelTag}</div>
      ${item
        ? `<div><strong>${item.emoji} ${item.name}</strong></div>
           ${roleLine}
           <small>+${item.stats?.hp || 0} HP · +${item.stats?.atk || 0} ATK · +${item.stats?.def || 0} DEF</small>`
        : '<div class="empty-text" style="padding:0">Vide</div>'}
    `;
    if (item) {
      const unequipBtn = document.createElement('button');
      unequipBtn.className = 'btn btn-small';
      unequipBtn.textContent = 'Retirer';
      unequipBtn.addEventListener('click', () => game.doUnequipCombat(slot.id));
      card.appendChild(unequipBtn);
    }
    combatSlotsEl.appendChild(card);
  }

  const ownedEl = panel.querySelector('#combat-owned');
  const owned = game.getOwnedCombatItems();
  if (owned.length === 0) {
    ownedEl.innerHTML = '<p class="empty-text">Aucun équipement en réserve. Craft à l\'atelier.</p>';
  } else {
    for (const ref of owned) {
      const item = resolveItem(s, ref, game.combatEquipment.items);
      if (!item) continue;
      const slotDef = game.combatEquipment.slots[item.slot];
      const isEquipped = s.combatEquipment?.[item.slot] === ref;
      if (isEquipped) continue;

      const row = document.createElement('div');
      row.className = 'combat-owned-row';

      const btn = document.createElement('button');
      btn.className = 'btn btn-small';
      btn.dataset.tutorialEquipRef = ref;
      btn.textContent = `Équiper · ${game.getCombatItemLabel(ref)} · Nv.${getItemLevel(item)}`;
      btn.addEventListener('click', () => game.doEquipCombat(ref));
      row.appendChild(btn);

      const dismantleCheck = game.canDismantleCombat(ref);
      if (dismantleCheck.ok) {
        const dismantleBtn = document.createElement('button');
        dismantleBtn.type = 'button';
        dismantleBtn.className = 'btn btn-small btn-muted';
        const rate = Math.round((game.balance.dismantle?.recoveryRate ?? 0.45) * 100);
        dismantleBtn.textContent = `Démanteler (~${rate}%)`;
        dismantleBtn.addEventListener('click', () => {
          const preview = game.getDismantlePreview(ref);
          if (!preview?.ok) return;
          const parts = Object.entries(preview.recovered)
            .map(([id, n]) => `${n}× ${game.resources[id]?.name || id}`)
            .join(', ');
          const msg = `Démanteler ${item.name} ?\nRécupération : ${parts || '—'}`;
          if (!window.confirm(msg)) return;
          const result = game.doDismantleCombat(ref);
          if (!result?.ok && result?.reason) window.alert(result.reason);
        });
        row.appendChild(dismantleBtn);
      }

      ownedEl.appendChild(row);
    }
    if (!ownedEl.children.length) {
      ownedEl.innerHTML = '<p class="empty-text">Tout ton équipement est déjà porté.</p>';
    }
  }

  const gatherEl = panel.querySelector('#char-gather-equip');
  const tools = getOwnedGatheringEquipment(s, game.equipment, game.recipes, game.jobs);
  const equipped = tools.filter((t) => t.equipped);
  const reserve = tools.filter((t) => !t.equipped);

  if (equipped.length === 0 && reserve.length === 0) {
    gatherEl.innerHTML = '<p class="empty-text">Aucun outil — fabrique-les à l\'Atelier Outilleur.</p>';
  } else {
    if (equipped.length > 0) {
      const title = document.createElement('div');
      title.className = 'char-tools-subtitle';
      title.textContent = 'Équipés';
      gatherEl.appendChild(title);
      const wrap = document.createElement('div');
      wrap.className = 'char-tools-group';
      for (const entry of equipped) appendGatheringToolRow(game, wrap, entry, { showUnequip: true });
      gatherEl.appendChild(wrap);
    }
    if (reserve.length > 0) {
      const title = document.createElement('div');
      title.className = 'char-tools-subtitle';
      title.textContent = 'En réserve';
      gatherEl.appendChild(title);
      const wrap = document.createElement('div');
      wrap.className = 'char-tools-group';
      for (const entry of reserve) appendGatheringToolRow(game, wrap, entry, { showEquip: true });
      gatherEl.appendChild(wrap);
    }
  }
}

function renderCharStatsTab(game, panel) {
  const charProg = game.getCharacterProgress();
  const statsBreakdown = game.getCharacterStatsBreakdown();

  panel.innerHTML = `
    <h3>📊 Stats de combat</h3>
    ${renderDQStatsBlock(statsBreakdown, charProg)}
    ${statsBreakdown.sets.length ? `<div class="stat-row stat-sets">${statsBreakdown.sets.map((setInfo) => {
      const label = SET_LABELS[setInfo.setId] || setInfo.setId;
      return `✨ Set ${label} (${setInfo.count} pièces)`;
    }).join(' · ')}</div>` : ''}
    <p class="view-desc">Les bonus de set s'activent à 4 et 8 pièces du même set.</p>
  `;
}

function renderCharJobsTab(game, panel) {
  panel.innerHTML = `
    <h3>📜 Métiers de récolte</h3>
    <div id="char-jobs"></div>
    <h3 class="char-subsection-title">🔨 Métiers d'artisanat</h3>
    <div id="char-craft-jobs"></div>
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

  const craftJobsEl = panel.querySelector('#char-craft-jobs');
  for (const job of game.getCraftJobs()) {
    const prog = game.getJobProgress(job.id);
    const pct = (prog.xp / prog.needed) * 100;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'job-row job-row-link';
    row.innerHTML = `
      <span>${job.emoji} ${job.name} <strong>Nv.${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}</strong></span>
      <div class="xp-bar-container"><div class="xp-bar" style="width:${pct}%"></div></div>
    `;
    row.addEventListener('click', () => navigate(JOB_VIEW_MAP[job.id] || 'character'));
    craftJobsEl.appendChild(row);
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
      card.innerHTML = `
        <div class="companion-head">
          <span class="companion-emoji">${def.emoji}</span>
          <div>
            <strong>${def.name}</strong>
            <p class="view-desc">${def.description}</p>
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

function renderMissions(game, el) {
  const season = game.state.season || 1;
  const chapters = game.getQuestsByChapter();
  const completedCount = game.state.quests?.completed?.length || 0;
  const totalCount = Object.keys(game.quests).length;
  const nextQuest = game.getNextQuest();
  const questReady = nextQuest && !isQuestCompleted(game.state, nextQuest.id) && isQuestReady(nextQuest, game.state, game.recipes);

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('missions'), 'view-header-icon', 'Missions')} Missions</h2>
      <p class="view-desc">Saison ${season} · ${completedCount}/${totalCount} missions accomplies</p>
    </div>
    <div class="mission-current panel-inner" id="mission-current"></div>
    <div class="panel-inner" id="mission-chapters"></div>
  `;

  renderObjectiveBanner(game, el.querySelector('#mission-current'), { ready: questReady });

  const chaptersEl = el.querySelector('#mission-chapters');
  const chapterOrder = ['village_sakura', 'petal_forest', 'mist_river', 'jade_mountains', 'lotus_sanctuary'];
  for (const chapterId of chapterOrder) {
    const data = chapters[chapterId];
    if (!data) continue;
    const all = [...data.completed, ...data.available, ...data.locked].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (all.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'mission-chapter';
    section.innerHTML = `<h3 class="mission-chapter-title">${QUEST_CHAPTER_LABELS[chapterId] || chapterId}</h3>`;

    const list = document.createElement('div');
    list.className = 'quest-list quest-list-compact';

    for (const quest of all) {
      const done = isQuestCompleted(game.state, quest.id);
      const available = !done && isQuestAvailable(quest, game.state, game.recipes);
      const isNext = nextQuest?.id === quest.id;
      const row = document.createElement('div');
      row.className = `quest-row${done ? ' quest-done' : ''}${isNext ? ' quest-ready' : ''}${!available && !done ? ' quest-locked' : ''}`;
      row.innerHTML = `
        <div class="quest-row-head">
          <strong>${done ? '✓ ' : ''}${quest.title}</strong>
          <span class="quest-status">${done ? 'Terminée' : getQuestStatusText(quest, game.state, game.recipes)}</span>
        </div>
        <p class="quest-desc">${quest.description}</p>
      `;
      list.appendChild(row);
    }

    section.appendChild(list);
    chaptersEl.appendChild(section);
  }
}

/* ── Monde ── */
function renderWorld(game, el) {
  const s = game.state;
  const next = game.getNextQuest();
  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('world'), 'view-header-icon', 'Monde')} Monde</h2>
      <p class="view-desc">Voyage entre les zones pour accéder aux ressources</p>
    </div>
    ${next && !isQuestCompleted(game.state, next.id) ? `
      <div class="quest-banner mission-teaser">
        <span class="quest-banner-label">Mission</span>
        <strong>${next.title}</strong>
        <span class="quest-banner-progress">${getQuestStatusText(next, game.state, game.recipes)}</span>
        <button type="button" class="btn btn-small btn-muted" id="goto-missions">Toutes les missions</button>
      </div>
    ` : ''}
    <div id="world-list"></div>
  `;
  el.querySelector('#goto-missions')?.addEventListener('click', () => navigate('missions'));
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

    const chips = zoneResources.map((r) => {
      const job = game.jobs[r.job];
      return `<span class="world-res-chip" title="${job?.name || ''} Nv.${r.requiredJobLevel}">${renderResourceIcon(r, 'world-res-icon')}${r.name}</span>`;
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

function renderHarvestSlot(game, jobId, slotIndex, container) {
  const slot = game.state.harvestSlots?.[jobId]?.[slotIndex];
  const assignable = game.getAssignableResources(jobId).filter((r) =>
    isResourceUnlockedByJob(r, game.state)
  );
  const active = !!slot?.active;
  const progress = active ? game.getSlotHarvestProgress(jobId, slotIndex) : 0;
  const selectedId = slot?.resourceId;
  const selected = selectedId ? game.resources[selectedId] : null;
  const display = getSlotVisualDisplay(selected, slot, progress);

  const card = document.createElement('div');
  card.className = `harvest-slot state-${display.visualState}${active ? ' active-harvest' : ''}`;
  card.dataset.job = jobId;
  card.dataset.slot = String(slotIndex);
  card.dataset.visualState = display.visualState;

  const phase = slot?.active?.phase;
  const btnLabel = getHarvestBtnLabel(phase, progress);
  const toolBlock = !active && selectedId
    ? game.getHarvestToolBlockReason(jobId, selectedId)
    : null;
  const harvestHint = !active && selectedId
    ? (game.getHarvestSlotHint?.(jobId, selectedId) || toolBlock)
    : null;

  const spriteHtml = display.sprite
    ? `<img class="slot-visual-sprite" src="${display.sprite}" alt="" />`
    : `<span class="slot-visual-emoji" aria-hidden="true">${display.emoji || '⬜'}</span>`;

  card.innerHTML = `
    <div class="slot-visual" data-state="${display.visualState}">
      ${spriteHtml}
    </div>
    <div class="slot-footer">
      <div class="slot-picker-mount"></div>
      ${harvestHint ? `<p class="slot-tool-hint">${harvestHint}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}" ${active || !selectedId || toolBlock ? 'disabled' : ''} title="${harvestHint || 'Récolter'}">
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

  container.appendChild(card);
}

export function patchHarvestSlot(game, jobId, slotIndex) {
  const container = document.getElementById('harvest-slots');
  if (!container) return;
  const old = container.querySelector(`.harvest-slot[data-job="${jobId}"][data-slot="${slotIndex}"]`);
  if (old) old.remove();
  renderHarvestSlot(game, jobId, slotIndex, container);
}

export function updateHarvestSlotProgresses(game) {
  for (const [jobId, slots] of Object.entries(game.state.harvestSlots || {})) {
    slots.forEach((slot, slotIndex) => {
      if (!slot?.active) return;
      const card = document.querySelector(`.harvest-slot[data-job="${jobId}"][data-slot="${slotIndex}"]`);
      if (!card) return;

      const progress = game.getSlotHarvestProgress(jobId, slotIndex);
      const resource = slot.resourceId ? game.resources[slot.resourceId] : null;
      const display = getSlotVisualDisplay(resource, slot, progress);

      card.dataset.visualState = display.visualState;
      card.classList.remove('state-available', 'state-regrowing', 'state-harvesting', 'state-empty');
      card.classList.add(`state-${display.visualState}`);

      const visual = card.querySelector('.slot-visual');
      if (visual) {
        visual.dataset.state = display.visualState;
        let spriteEl = visual.querySelector('.slot-visual-sprite');
        if (display.sprite) {
          if (!spriteEl) {
            visual.innerHTML = `<img class="slot-visual-sprite" src="${display.sprite}" alt="" />`;
          } else {
            spriteEl.src = display.sprite;
          }
        } else if (!visual.querySelector('.slot-visual-emoji')) {
          visual.innerHTML = `<span class="slot-visual-emoji" aria-hidden="true">${display.emoji || '⬜'}</span>`;
        }
      }

      const emojiEl = card.querySelector('.slot-visual-emoji');
      if (emojiEl) emojiEl.textContent = display.emoji || '⬜';

      const btn = card.querySelector('.btn-start');
      if (btn) {
        btn.textContent = getHarvestBtnLabel(display.phase, progress);
        btn.classList.toggle('harvesting-btn', display.phase === 'harvesting');
        btn.classList.toggle('regrowing-btn', display.phase === 'regrowing');
        btn.disabled = !!display.phase || !slot.resourceId;
      }

      const picker = card.querySelector('.resource-picker.picker-slot');
      if (picker) {
        const assignable = game.getAssignableResources(jobId).filter((r) =>
          isResourceUnlockedByJob(r, game.state)
        );
        syncPickerToggle(picker, slot.resourceId, assignable, slot, progress);

        if (resource) {
          const chip = getPickerChipVisual(resource, slot.resourceId, slot);
          const selectedChip = picker.querySelector('.resource-pick-btn.selected');
          if (selectedChip) {
            selectedChip.className = `resource-pick-btn selected${chip.stateClass}`;
            const iconWrap = selectedChip.querySelector('.pick-icon-wrap');
            if (iconWrap) iconWrap.innerHTML = chip.icon;
            const pickName = selectedChip.querySelector('.pick-name');
            if (pickName) pickName.textContent = chip.name;
          }
        }
      }
    });
  }
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

function buildFarmFeedPickerHtml(game, building, slot, active) {
  const allFeeds = listFeedOptions(building);
  if (!allFeeds.length) return { pickerHtml: '', canAffordSelected: true };

  const feedOptions = allFeeds.map((feedId) => {
    const res = game.resources[feedId];
    const affordable = canAffordFeed(building, feedId, game.state);
    const selected = slot?.feedId === feedId ? ' selected' : '';
    const unaffordable = affordable ? '' : ' farm-feed-unaffordable';
    return `<button type="button" class="farm-feed-btn${selected}${unaffordable}" data-feed="${feedId}" ${active ? 'disabled' : ''}>${renderResourceIcon(res, 'pick-icon') || ''} ${res?.name || feedId}</button>`;
  }).join('');

  const costHtml = slot?.feedId
    ? buildFarmFeedCostHtml(game, building, slot.feedId)
    : '<p class="farm-feed-hint empty-text">Choisis une ration pour voir le coût</p>';

  return {
    pickerHtml: `<div class="farm-feed-picker">${feedOptions}</div>${costHtml}`,
    canAffordSelected: !slot?.feedId || canAffordFeed(building, slot.feedId, game.state),
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
    const zone = game.getCurrentZone();
    meta.textContent = `Niveau ${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''} · ${zone?.name || ''}`;
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
  const job = game.jobs[jobId];
  const prog = game.getJobProgress(jobId);
  const zone = game.getCurrentZone();
  const pct = (prog.xp / prog.needed) * 100;
  const maxSlots = game.balance.harvestSlots.maxSlots;
  const ownedSlots = game.getMaxHarvestSlots(jobId);
  const assignable = game.getAssignableResources(jobId);
  const lockedResources = assignable.filter((r) => !isResourceUnlockedByJob(r, game.state));
  const currentView = getHarvestViewForJob(jobId);
  const prevView = currentView ? getAdjacentHarvestView(currentView, -1) : null;
  const nextView = currentView ? getAdjacentHarvestView(currentView, 1) : null;
  const prevJob = prevView ? VIEWS[prevView]?.job : null;
  const nextJob = nextView ? VIEWS[nextView]?.job : null;

  el.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-top job-nav-header">
        <button type="button" class="btn btn-muted btn-job-nav" id="job-prev" aria-label="Métier précédent" ${prevView ? '' : 'disabled'}>‹</button>
        <div class="job-nav-center">
          <div class="skill-header-title">${getJobIcon(jobId) ? iconHtml(getJobIcon(jobId), 'job-icon', job.name) : ''} ${job.name}</div>
          <div class="skill-header-meta">Niveau ${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''} · ${zone?.name || ''}</div>
        </div>
        <button type="button" class="btn btn-muted btn-job-nav" id="job-next" aria-label="Métier suivant" ${nextView ? '' : 'disabled'}>›</button>
      </div>
      <div class="job-nav-hints">
        ${prevJob ? `<span class="job-nav-hint">${game.jobs[prevJob]?.name || ''}</span>` : '<span></span>'}
        ${nextJob ? `<span class="job-nav-hint">${game.jobs[nextJob]?.name || ''}</span>` : '<span></span>'}
      </div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.atSeasonCap ? `Plafond Saison ${game.state.season || 1} — passe à la suivante` : `${prog.xp} / ${prog.needed} XP`}</p>
    </div>
    ${buildJobEquippedToolsStrip(game, jobId)}
    ${buildHarvestInventoryStrip(game, jobId)}
    <div class="panel-inner">
      <div class="panel-head-row">
        <h3>Emplacements de récolte</h3>
        <button class="btn btn-muted btn-small" id="goto-world" type="button">Changer de zone</button>
      </div>
      <div class="slots-grid" id="harvest-slots"></div>
    </div>
    ${lockedResources.length > 0 ? `
      <div class="panel-inner panel-muted">
        <h3>Ressources verrouillées</h3>
        <div class="resource-grid" id="locked-resources"></div>
      </div>
    ` : ''}
  `;

  el.querySelector('#goto-world')?.addEventListener('click', () => navigate('world'));
  el.querySelector('#job-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#job-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });

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
    for (const resource of lockedResources) {
      const tile = document.createElement('div');
      tile.className = 'resource-tile locked-res';
      tile.innerHTML = `
        <div class="tile-head">
          ${renderResourceIcon(resource, 'tile-resource-icon')}
          <div>
            <div class="tile-name">${resource.name}</div>
            <div class="tile-lock">🔒 Requis : ${job.name} Nv.${resource.requiredJobLevel || 1}</div>
          </div>
        </div>
      `;
      lockedEl.appendChild(tile);
    }
  }
}

function getFarmBtnLabel(progress) {
  if (progress <= 0) return 'Produire';
  if (progress >= 1) return 'Production terminée…';
  const pct = Math.min(99, Math.floor(progress * 100));
  return `Production ${pct}%`;
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
  const toolBlock = game.getFarmToolBlockReason(buildingId);
  const sprite = getFarmBuildingSprite(building);
  const tutorialFarm = game.state.tutorial?.sandbox
    && game.tutorialData?.steps?.[game.state.tutorial?.stepIndex]?.id === 'farm'
    && buildingId === 'well'
    && slotIndex === 0;
  const tutorialChicken = game.state.tutorial?.sandbox
    && game.tutorialData?.steps?.[game.state.tutorial?.stepIndex]?.id === 'farm_chicken'
    && buildingId === 'chicken_coop'
    && slotIndex === 0;
  const feedBlocked = needsFeed && (!slot?.feedId || !feedUi.canAffordSelected);

  const card = document.createElement('div');
  card.className = `farm-slot harvest-slot${active ? ' active-harvest' : ''}`;
  card.dataset.building = buildingId;
  card.dataset.slot = String(slotIndex);

  container.querySelector(`.farm-slot[data-slot="${slotIndex}"]`)?.remove();

  const spriteHtml = sprite
    ? `<img class="slot-visual-sprite" src="${sprite}" alt="" />`
    : `<span class="slot-visual-emoji" aria-hidden="true">${building.emoji || '🏠'}</span>`;

  card.innerHTML = `
    <div class="slot-visual" data-state="${active ? 'harvesting' : 'available'}">
      ${spriteHtml}
    </div>
    <div class="slot-footer">
      ${needsFeed ? feedUi.pickerHtml : ''}
      ${toolBlock ? `<p class="slot-tool-hint">${toolBlock}</p>` : ''}
      <button type="button" class="btn btn-harvest-compact btn-start${active ? ' harvesting-btn' : ''}" id="${tutorialFarm ? 'tutorial-farm-start-well' : tutorialChicken ? 'tutorial-farm-start-chicken' : ''}" ${active || (!tutorialFarm && !tutorialChicken && toolBlock) || feedBlocked ? 'disabled' : ''}>
        ${getFarmBtnLabel(progress)}
      </button>
    </div>
  `;

  if (!active) {
    card.querySelectorAll('.farm-feed-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        game.setFarmFeed(buildingId, slotIndex, btn.dataset.feed);
        renderFarmSlot(game, buildingId, slotIndex, building, container);
      });
    });
    card.querySelector('.btn-start')?.addEventListener('click', () => {
      const result = game.startFarmSlot(buildingId, slotIndex);
      if (!result?.ok && result?.reason) emit('farmBlocked', { message: result.reason });
      else if (game.isTutorialActive()) scheduleTutorialOverlayRefresh(game, 2);
    });
  }

  container.appendChild(card);
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

export function updateFarmSlotProgresses(game) {
  for (const buildingId of FARM_BUILDING_IDS) {
    const slots = game.state.farmSlots?.[buildingId] || [];
    slots.forEach((slot, slotIndex) => {
      const card = document.querySelector(`.farm-slot[data-building="${buildingId}"][data-slot="${slotIndex}"]`);

      if (!slot?.active) {
        if (card?.classList.contains('active-harvest')) {
          patchFarmSlot(game, buildingId, slotIndex);
        }
        return;
      }

      const elapsed = Date.now() - slot.active.start;
      if (elapsed >= slot.active.duration) {
        game.completeFarmSlot(buildingId, slotIndex);
        patchFarmSlot(game, buildingId, slotIndex);
        return;
      }

      if (!card) return;
      const progress = game.getFarmSlotProgress(buildingId, slotIndex);
      const btn = card.querySelector('.btn-start');
      if (btn) {
        btn.textContent = getFarmBtnLabel(progress);
        btn.classList.add('harvesting-btn');
        btn.disabled = true;
      }
    });
  }
  syncStaleFarmSlots(game);
}

function renderFarmBuilding(game, el, buildingId) {
  game.prepareTutorialSandboxForStep?.();
  const building = getBuildingDef(game.farmData, buildingId);
  if (!building) return;

  const job = game.jobs.breeder;
  const prog = game.getJobProgress('breeder');
  const pct = (prog.xp / prog.needed) * 100;
  const toolBlock = game.getFarmToolBlockReason(buildingId);
  const currentView = getFarmViewForBuilding(buildingId);
  const prevView = getAdjacentFarmView(currentView, -1);
  const nextView = getAdjacentFarmView(currentView, 1);
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
      <div class="job-nav-hints">
        ${prevBuilding ? `<span class="job-nav-hint">${prevBuilding}</span>` : '<span></span>'}
        ${nextBuilding ? `<span class="job-nav-hint">${nextBuilding}</span>` : '<span></span>'}
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
  `;

  el.querySelector('#farm-prev')?.addEventListener('click', () => { if (prevView) navigate(prevView); });
  el.querySelector('#farm-next')?.addEventListener('click', () => { if (nextView) navigate(nextView); });

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
  if (workshopTab === 'cook') workshopTab = 'toolmaker';
  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('workshop'), 'view-header-icon', 'Atelier')} Atelier</h2>
      <p class="view-desc">Fabrique outils, armes et équipements — choisis un métier ci-dessous</p>
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
      if (game.isTutorialActive()) {
        scheduleTutorialOverlayRefresh(game, 2);
      }
    });
    tabsEl.appendChild(btn);
  }

  renderWorkshop(game, el.querySelector('#workshop-content'), workshopTab);
}

function renderCuisine(game, el) {
  const job = game.jobs.cook;
  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('cuisine'), 'view-header-icon', 'Cuisine')} Cuisine</h2>
      <p class="view-desc">${job?.emoji || '👨‍🍳'} ${job?.name || 'Cuisinier'} — prépare des plats pour les buffs de donjon et les festins</p>
    </div>
    <div id="cuisine-content"></div>
  `;
  renderWorkshop(game, el.querySelector('#cuisine-content'), 'cook');
}

export function renderWorkshop(game, el, craftJobId) {
  game.prepareTutorialCraftIfNeeded?.();
  const job = game.jobs[craftJobId];
  const prog = game.getJobProgress(craftJobId);
  const pct = (prog.xp / prog.needed) * 100;
  const isTools = craftJobId === 'toolmaker';
  const isCook = craftJobId === 'cook';

  el.innerHTML = `
    <div class="skill-header">
      <div class="skill-header-title">${job?.emoji || '🔨'} ${job?.name || 'Atelier'}</div>
      <div class="skill-header-meta">Niveau ${prog.level}${prog.seasonCap ? ` / ${prog.seasonCap}` : ''}${prog.atSeasonCap ? ' · plafond saison' : ''}</div>
      <div class="xp-bar-container xp-large"><div class="xp-bar" style="width:${pct}%"></div></div>
      <p class="xp-text">${prog.xp} / ${prog.needed} XP</p>
    </div>
    ${isTools || isCook ? '' : `
    <div class="merchant-hint panel-inner">
      <span>📜 Les fabrications avancées requièrent des <strong>Parchemins des Anciens</strong>.</span>
      <button type="button" class="btn btn-muted btn-sm" id="goto-auction">🏛️ Hôtel des Ventes</button>
    </div>`}
    ${isCook ? `
    <div class="merchant-hint panel-inner cuisine-hint">
      <span>🍲 Les plats consommables donnent des bonus en donjon. Équipe ton tablier sur Perso si tu en as un.</span>
    </div>` : ''}
    <div class="panel-inner" id="craft-panels"></div>
  `;

  el.querySelector('#goto-auction')?.addEventListener('click', () => navigate('auction_house'));

  const panels = el.querySelector('#craft-panels');
  const crafted = game.state.crafted || [];
  const available = [];
  const owned = [];
  const locked = [];

  const recipeJobLevel = (recipe) => {
    const craftJob = getRecipeCraftJob(recipe);
    return game.getJobProgress(craftJob).level;
  };

  for (const [id, recipe] of Object.entries(game.recipes)) {
    if (!recipeBelongsToWorkshopTab(id, recipe, craftJobId, game.equipment)) continue;
    if (recipe.tutorialOnly && !game.state.tutorial?.sandbox) continue;
    if (!game.isTutorialCraftRecipe(id)) continue;
    if (recipe.unique && !recipe.repeatable && crafted.includes(id)) {
      if (game.isTutorialForcedCraft?.(id)) {
        available.push([id, recipe]);
        continue;
      }
      if (isDurabilityTool(recipe) && !hasWorkingTool(game.state, id, recipe)) {
        const req = getRecipeRequiredLevel(recipe);
        if (req && recipeJobLevel(recipe) < req) locked.push([id, recipe]);
        else available.push([id, recipe]);
        continue;
      }
      owned.push([id, recipe]);
      continue;
    }
    const req = getRecipeRequiredLevel(recipe);
    const lockedByLevel = req && recipeJobLevel(recipe) < req;
    if (lockedByLevel) locked.push([id, recipe]);
    else available.push([id, recipe]);
  }

  if (available.length > 0) {
    panels.innerHTML += '<div class="craft-section-title">✅ Disponibles</div><div class="craft-grid" id="craft-available"></div>';
    const grid = panels.querySelector('#craft-available');
    for (const [id, recipe] of available) {
      appendCraftTile(game, id, recipe, grid);
    }
  }

  if (owned.length > 0) {
    panels.innerHTML += '<div class="craft-section-title">📦 Possédé</div><div class="craft-grid" id="craft-owned"></div>';
    const grid = panels.querySelector('#craft-owned');
    for (const [id, recipe] of owned) {
      appendCraftTile(game, id, recipe, grid, false, true);
    }
  }

  if (locked.length > 0) {
    panels.innerHTML += '<div class="craft-section-title">🔒 Verrouillées</div><div class="craft-grid" id="craft-locked"></div>';
    const grid = panels.querySelector('#craft-locked');
    for (const [id, recipe] of locked) {
      appendCraftTile(game, id, recipe, grid, true);
    }
  }
}

function appendCraftTile(game, id, recipe, container, forceLocked = false, isOwned = false) {
  const forcedTutorialCraft = game.isTutorialForcedCraft?.(id);
  const isBroken = isDurabilityTool(recipe) && isToolBroken(game.state, id, recipe);
  const isWorkingOwned = isOwned && !isBroken && !forcedTutorialCraft;
  if (forcedTutorialCraft) game.prepareTutorialSandboxForStep?.();
  const canDo = forcedTutorialCraft
    || (!forceLocked && !isWorkingOwned && canCraft(id, game.recipes, game.state, game.balance, game.jobs));
  const blockReason = !forceLocked && !isWorkingOwned && !forcedTutorialCraft && !canDo
    ? getCraftBlockReason(id, game.recipes, game.state, game.balance, game.jobs, game.resources)
    : null;
  const ingredients = forcedTutorialCraft
    ? '<span class="ing-ok">🎁 Offert pour la formation</span>'
    : Object.entries(recipe.ingredients)
      .map(([resId, amt]) => {
        const res = game.resources[resId];
        const have = game.state.inventory[resId] || 0;
        const combatCls = res?.combatOnly ? ' ing-combat' : '';
        return `<span class="${have >= amt ? 'ing-ok' : 'ing-missing'}${combatCls}">${renderResourceIcon(res, 'ing-icon') || (res ? '' : '?')} ${have}/${amt}</span>`;
      }).join('');
  const kirhaCost = recipe.kirhaCost || 0;
  const kirhaHtml = !forcedTutorialCraft && kirhaCost > 0
    ? `<span class="${game.state.kirha >= kirhaCost ? 'ing-ok' : 'ing-missing'}">💰 ${game.state.kirha}/${kirhaCost}</span>`
    : '';

  let blockHtml = '';
  if (forceLocked) {
    blockHtml = `<p class="tile-lock">🔒 Niveau métier : ${game.jobs[recipe.craftJob]?.name || 'Métier'} Nv.${getRecipeRequiredLevel(recipe)}</p>`;
  } else if (blockReason?.type === 'level') {
    blockHtml = `<p class="tile-lock">🔒 ${blockReason.message}</p>`;
  } else if (blockReason?.type === 'ingredients') {
    blockHtml = `<p class="tile-lock tile-lock-ing">📦 ${blockReason.message}</p>`;
  } else if (blockReason?.type === 'owned') {
    blockHtml = `<p class="tile-lock">✓ ${blockReason.message}</p>`;
  } else if (blockReason?.type === 'kirha') {
    blockHtml = `<p class="tile-lock tile-lock-ing">💰 ${blockReason.message}</p>`;
  } else if (blockReason?.type === 'zone') {
    blockHtml = `<p class="tile-lock">🗺️ ${blockReason.message}</p>`;
  }

  let combatPreviewHtml = '';
  if (recipe.combatItem) {
    const preview = getCombatItemPreview(recipe.combatItem, game.combatEquipment.items, game.weaponRoles);
    if (preview) {
      const roleBadge = preview.roleLabel && preview.roleShort
        ? `<div class="craft-role-badge">${preview.roleLabel} · ${preview.roleShort}</div>`
        : '';
      combatPreviewHtml = `
        <div class="craft-combat-preview">
          <div class="tile-stats">Nv.${preview.level} · ${preview.statsLine}</div>
          ${roleBadge}
          <div class="tile-stats craft-equipped-preview">Si équipé : ${preview.statsLine}</div>
        </div>
      `;
    }
  }

  const durabilityHtml = renderCraftDurabilityInfo(game.state, id, recipe, {
    owned: (game.state.crafted || []).includes(id) && !isBroken,
    broken: isBroken,
  });
  const craftBtnLabel = forcedTutorialCraft ? 'Fabriquer' : (isBroken ? 'Refabriquer' : (isWorkingOwned ? 'Possédé' : 'Fabriquer'));

  const tile = document.createElement('div');
  tile.className = `craft-tile${canDo ? ' affordable' : ''}${forceLocked ? ' locked-res' : ''}${isWorkingOwned ? ' craft-owned' : ''}${isBroken ? ' craft-broken' : ''}`;
  tile.dataset.recipeId = id;
  const craftBtnId = forcedTutorialCraft ? `tutorial-craft-${id}` : '';
  const craftBtnAttrs = canDo || forcedTutorialCraft ? '' : 'disabled';
  tile.innerHTML = `
    <div class="tile-name">${recipe.emoji} ${recipe.name}${recipe.repeatable ? ' ♻️' : ''}</div>
    <p class="tile-stats">${recipe.description}</p>
    ${durabilityHtml}
    ${combatPreviewHtml}
    ${blockHtml}
    ${isBroken ? '<p class="tile-lock tile-lock-broken">🔧 Outil usé — refabriquer pour réparer</p>' : ''}
      ${isWorkingOwned && !forcedTutorialCraft ? '<p class="tile-lock">✓ En service</p>' : ''}
    <div class="ingredients">${ingredients}${kirhaHtml ? ` ${kirhaHtml}` : ''}</div>
    ${getRecipeJobXp(recipe) ? `<div class="tile-stats">+${getRecipeJobXp(recipe)} XP ${game.jobs[recipe.craftJob]?.name || ''}</div>` : ''}
    <button type="button" class="btn btn-craft" id="${craftBtnId}" ${craftBtnAttrs}>${craftBtnLabel}</button>
  `;
  const craftBtn = tile.querySelector('.btn-craft');
  if (canDo || forcedTutorialCraft) {
    if (forcedTutorialCraft && craftBtn?.disabled) craftBtn.removeAttribute('disabled');
    craftBtn?.addEventListener('click', () => {
      game.prepareTutorialSandboxForStep?.();
      const ok = game.doCraft(id);
      if (!ok) {
        const message = game.getCraftFailureMessage?.(id) || 'Impossible de fabriquer pour le moment.';
        emit('craftBlocked', { recipeId: id, message });
      }
    });
  } else if (isWorkingOwned && game.equipment.equipable[id] && !isRecipeEquipped(game.state, id)) {
    const equipBtn = document.createElement('button');
    equipBtn.type = 'button';
    equipBtn.className = 'btn btn-small btn-muted';
    equipBtn.textContent = 'Équiper';
    equipBtn.addEventListener('click', () => game.doEquip(id));
    tile.appendChild(equipBtn);
  }
  container.appendChild(tile);
}

/* ── Hôtel des Ventes ── */
export function renderAuctionHouse(game, el) {
  game.prepareTutorialSandboxForStep?.();
  const merchant = game.merchant;
  const scrollRes = game.resources.ancient_scroll;
  const owned = game.getScrollCount();
  const tutoScrollStep = game.state.tutorial?.sandbox
    && game.tutorialData?.steps?.[game.state.tutorial?.stepIndex]?.id === 'scrolls';
  const bulkQty = tutoScrollStep ? [1] : null;

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('auction_house'), 'view-header-icon', merchant.name)} ${merchant.name}</h2>
      <p class="view-desc">${merchant.description}</p>
    </div>
    <div class="panel-inner auction-owned">
      <span class="auction-owned-label">Tes parchemins</span>
      <span class="auction-owned-value">${renderResourceIcon(scrollRes, 'auction-scroll-icon')} ×${owned}</span>
    </div>
    <div id="auction-vendors"></div>
    <div class="panel-inner auction-tip">
      <p>💡 Vends tes récoltes à la <button type="button" class="link-btn" id="goto-bank">Banque</button> pour obtenir des Kirha, puis achète des parchemins ici.</p>
    </div>
  `;

  el.querySelector('#goto-bank')?.addEventListener('click', () => navigate('inventory'));

  const vendorsEl = el.querySelector('#auction-vendors');
  for (const [vendorId, vendor] of Object.entries(merchant.vendors || {})) {
    const section = document.createElement('section');
    section.className = 'auction-vendor panel-inner';
    section.innerHTML = `<h3 class="auction-vendor-title">${vendor.emoji} ${vendor.name}</h3><p class="view-desc">${vendor.description}</p>`;

    const offersGrid = document.createElement('div');
    offersGrid.className = 'auction-offers';

    for (const [offerId, offer] of Object.entries(vendor.offers || {})) {
      const resource = game.resources[offer.resourceId];
      if (!resource) continue;

      const card = document.createElement('div');
      card.className = 'auction-offer-card';
      card.innerHTML = `
        <div class="auction-offer-head">
          <span class="auction-offer-icon">${renderResourceIcon(resource, 'auction-offer-icon')}</span>
          <div>
            <div class="auction-offer-name">${resource.name}</div>
            <div class="auction-offer-price">${formatNumber(offer.unitPrice)} 💰 / unité</div>
          </div>
        </div>
        <div class="auction-buy-row" data-vendor="${vendorId}" data-offer="${offerId}"></div>
      `;

      const row = card.querySelector('.auction-buy-row');
      for (const qty of bulkQty || offer.bulkQuantities || [1]) {
        const total = offer.unitPrice * qty;
        const canAfford = game.state.kirha >= total;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn btn-buy-scroll${canAfford ? ' affordable' : ''}`;
        btn.disabled = !canAfford;
        btn.textContent = `×${qty} — ${formatNumber(total)} 💰`;
        btn.addEventListener('click', () => game.buyMerchant(vendorId, offerId, qty));
        row.appendChild(btn);
      }

      offersGrid.appendChild(card);
    }

    section.appendChild(offersGrid);
    vendorsEl.appendChild(section);
  }
}

/* ── Inventaire (banque) ── */
export function renderInventory(game, el) {
  game.prepareTutorialSandboxForStep?.();
  el.innerHTML = `
    <div class="view-header"><h2>${iconHtml(getNavIcon('inventory'), 'view-header-icon', 'Banque')} Banque</h2><p class="view-desc">Clique un objet pour vendre ou équiper</p></div>
    <div class="panel-inner">
      <div class="bank-toolbar">
        <span class="bank-total" id="bank-total">Valeur totale : 0 💰</span>
        <button class="btn btn-sell-all" id="sell-all">Tout vendre</button>
      </div>
      <table class="bank-table bank-resource-list">
        <thead>
          <tr><th>Objet</th><th>Qté</th><th>Prix/u</th><th>Valeur</th></tr>
        </thead>
        <tbody id="bank-body"></tbody>
      </table>
    </div>
  `;

  el.querySelector('#sell-all').addEventListener('click', () => game.sellEverything());

  const tbody = el.querySelector('#bank-body');
  let totalValue = 0;
  let hasItems = false;

  for (const [id, amount] of Object.entries(game.state.inventory)) {
    if (amount <= 0) continue;
    const resource = game.resources[id];
    if (!resource) continue;
    hasItems = true;
    const notSellable = resource.notSellable || resource.merchantOnly;
    const bonus = resource.craftOnly && !notSellable ? getCraftSellBonus(game.state, game.jobs) : 1;
    const unitPrice = notSellable ? 0 : Math.floor(resource.sellPrice * bonus);
    const value = unitPrice * amount;
    if (!notSellable) totalValue += value;

    const tr = document.createElement('tr');
    tr.className = `bank-row${notSellable ? ' bank-row-special' : ''}`;
    tr.dataset.resourceId = id;
    tr.innerHTML = `
      <td class="bank-item-cell">${renderResourceIcon(resource)} ${resource.name}</td>
      <td>×${amount}</td>
      <td>${notSellable ? '—' : `${formatNumber(unitPrice)} 💰`}</td>
      <td>${notSellable ? '—' : `${formatNumber(value)} 💰`}</td>
    `;
    tr.addEventListener('click', () => openItemModal(game, id, resource, amount, unitPrice, notSellable));
    tbody.appendChild(tr);
  }

  el.querySelector('#bank-total').textContent = `Valeur totale : ${formatNumber(totalValue)} 💰`;
  if (!hasItems) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-text">Inventaire vide</td></tr>';
  }
}

function openItemModal(game, resourceId, resource, amount, unitPrice, notSellable = false) {
  const modal = document.getElementById('item-modal');
  const body = document.getElementById('item-modal-body');
  if (!modal || !body) return;

  const equipable = Object.entries(game.equipment.equipable).find(([, e]) => e.recipeId === resourceId);
  const recipe = equipable ? game.recipes[resourceId] : null;
  const isCrafted = (game.state.crafted || []).includes(resourceId);
  const isEquipped = isRecipeEquipped(game.state, resourceId);

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
    compareHtml = '<p class="item-stat-compare">Objet spécial — acheté à l\'Hôtel des Ventes. Requis pour de nombreuses fabrications.</p>';
  }

  const sellActions = notSellable
    ? `<button class="btn btn-craft" id="modal-goto-auction">${iconHtml(getNavIcon('auction_house'), 'btn-inline-icon', 'HDV')} Hôtel des Ventes</button>`
    : `
      <button class="btn btn-sell" id="modal-sell-1">Vendre 1</button>
      <button class="btn btn-sell-all" id="modal-sell-all">Vendre tout (×${amount})</button>
    `;

  body.innerHTML = `
    <h3 class="item-modal-title">${renderResourceIcon(resource, 'item-modal-icon')} ${resource.name}</h3>
    <p>Quantité : ×${amount}</p>
    ${notSellable ? '' : `<p>Prix unitaire : ${formatNumber(unitPrice)} 💰</p>`}
    ${compareHtml}
    <div class="modal-item-actions">
      ${sellActions}
      ${recipe && isCrafted && !isEquipped ? '<button class="btn btn-craft" id="modal-equip">Équiper</button>' : ''}
      <button class="btn btn-muted" id="modal-close">Fermer</button>
    </div>
  `;

  body.querySelector('#modal-sell-1')?.addEventListener('click', () => {
    game.sell(resourceId, 1);
    modal.classList.remove('active');
  });
  body.querySelector('#modal-sell-all')?.addEventListener('click', () => {
    game.sell(resourceId);
    modal.classList.remove('active');
  });
  body.querySelector('#modal-goto-auction')?.addEventListener('click', () => {
    modal.classList.remove('active');
    navigate('auction_house');
  });
  body.querySelector('#modal-equip')?.addEventListener('click', () => {
    game.doEquip(resourceId);
    modal.classList.remove('active');
  });
  body.querySelector('#modal-close')?.addEventListener('click', () => modal.classList.remove('active'));

  modal.classList.add('active');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
  if (game.isTutorialActive()) {
    scheduleTutorialOverlayRefresh(game);
  }
}

/* ── Options ── */
function emitPrestigeModal() {
  document.dispatchEvent(new CustomEvent('tokirha:prestige-open'));
}

export function renderOptions(game, el) {
  const beta = !!game.balance.betaMode;
  const info = game.getPrestigeInfo();
  const caps = info.caps || game.getSeasonCapPreview();
  const p = game.state.prestige || {};
  const progress = game.getPrestigeProgress();
  const blockerHtml = info.blockers?.length
    ? `<ul class="prestige-blockers">${info.blockers.map((b) => `<li>${b}</li>`).join('')}</ul>`
    : '';
  el.innerHTML = `
    <div class="view-header"><h2>${iconHtml(getNavIcon('options'), 'view-header-icon', 'Options')} Options</h2></div>
    <div class="panel-inner"><div id="settings-grid" class="settings-grid"></div></div>
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
    <div class="panel-inner">
      <h3>📖 Formation du village</h3>
      <p class="view-desc">${game.hasTutorialRewardsClaimed()
    ? 'Rejoue le tutoriel guidé pour réviser les étapes — les récompenses (matériaux, Kirha, parchemins…) ne sont données qu\'une seule fois.'
    : 'Rejoue le tutoriel guidé : récolte, arme, craft, donjon et parchemins (~5 min).'}</p>
      <button type="button" class="btn btn-muted" id="reset-tutorial">Revoir la formation</button>
    </div>
    <div class="panel-inner save-panel">
      <h3>${iconHtml(UI.save, 'panel-title-icon', 'Sauvegarde')} Sauvegarde</h3>
      <p class="save-info">Ta partie est <strong>sauvegardée automatiquement</strong> sur cet appareil. L'export ci-dessous sert de copie de secours.</p>
      <div class="save-actions">
        <button type="button" class="btn btn-save" id="export-save">Copier la sauvegarde</button>
        <button type="button" class="btn btn-save" id="download-save">Télécharger</button>
      </div>
      <textarea class="save-textarea" id="save-data" rows="3" readonly placeholder="Code de sauvegarde…"></textarea>
      <details class="save-import-details">
        <summary>Restaurer une sauvegarde</summary>
        <textarea class="save-textarea" id="save-import-data" rows="3" placeholder="Colle un code exporté…"></textarea>
        <button type="button" class="btn btn-save btn-import" id="import-save">Importer</button>
      </details>
      ${beta ? '' : `
      <details class="save-danger-details">
        <summary>Nouvelle partie</summary>
        <p class="save-warn">Efface toute la progression sur cet appareil. Un export est proposé avant.</p>
        <button type="button" class="btn btn-save btn-danger" id="reset-save">Réinitialiser</button>
      </details>`}
      <p class="save-hint" id="save-hint"></p>
    </div>
  `;

  renderSettingsIn(game, el.querySelector('#settings-grid'));
  el.querySelector('#prestige-btn')?.addEventListener('click', () => emitPrestigeModal());

  el.querySelector('#reset-tutorial')?.addEventListener('click', () => {
    game.resetTutorialForOptions();
    hint(game.hasTutorialRewardsClaimed()
      ? 'Formation relancée (mode révision, sans récompenses).'
      : 'Formation relancée — l\'introduction va s\'afficher.');
  });

  const hint = (msg) => { el.querySelector('#save-hint').textContent = msg; };

  el.querySelector('#export-save')?.addEventListener('click', async () => {
    const code = game.exportSave();
    const ta = el.querySelector('#save-data');
    ta.value = code;
    try {
      await navigator.clipboard.writeText(code);
      hint('Sauvegarde copiée dans le presse-papiers !');
    } catch {
      ta.select();
      hint('Sauvegarde affichée — copie-la manuellement.');
    }
  });

  el.querySelector('#download-save')?.addEventListener('click', () => {
    const code = game.exportSave();
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tokirha-save-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    hint('Fichier téléchargé.');
  });

  el.querySelector('#import-save')?.addEventListener('click', () => {
    const r = game.importSave(el.querySelector('#save-import-data').value);
    hint(r.ok ? 'Sauvegarde restaurée !' : (r.error || 'Import impossible'));
  });

  el.querySelector('#reset-save')?.addEventListener('click', async () => {
    const step1 = confirm('Créer une nouvelle partie ? Ta progression actuelle sera perdue.');
    if (!step1) return;
    const typed = prompt('Tape EFFACER pour confirmer (un export sera copié avant) :');
    if (typed !== 'EFFACER') {
      hint('Réinitialisation annulée.');
      return;
    }
    try {
      await navigator.clipboard.writeText(game.exportSave());
      hint('Ancienne sauvegarde exportée dans le presse-papiers. Réinitialisation…');
    } catch {
      hint('Réinitialisation…');
    }
    game.resetSave();
  });
}

export function renderSettingsIn(game, container) {
  const s = game.state.settings;
  container.innerHTML = `
    <label class="setting-row"><span>🔔 Effets sonores</span><input type="checkbox" id="set-sfx" ${s.sfx ? 'checked' : ''}></label>
    <label class="setting-row"><span>Volume SFX</span><input type="range" id="set-sv" min="0" max="100" value="${Math.round((s.sfxVolume ?? 0.35) * 100)}"></label>
  `;
  container.querySelector('#set-sfx').addEventListener('change', (e) => game.updateSettings({ sfx: e.target.checked }));
  container.querySelector('#set-sv').addEventListener('input', (e) => game.updateSettings({ sfxVolume: e.target.value / 100 }));
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
  const stats = game.getCharacterStats();
  const charProg = game.getCharacterProgress();
  const weaponRef = game.state.combatEquipment?.weapon;
  const weapon = weaponRef ? resolveItem(game.state, weaponRef, game.combatEquipment.items) : null;
  const weaponLabel = weapon
    ? `${weapon.emoji} ${weapon.name}${weapon.className ? ` (${weapon.className})` : ''}`
    : 'Sans arme';
  const tutorialUi = game.getTutorialUi();
  const showTutorialDungeon = !!tutorialUi?.isDungeonStep;
  const daily = game.getCombatDailyStatus();
  const dungeonCfg = game.getDungeonUnlockConfig();
  const activeMeal = game.getActiveMealId();
  const ownedMeals = game.getOwnedMeals();

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('combat'), 'view-header-icon', 'Combat')} Combat</h2>
      <p class="view-desc">${game.getCharacterDisplayName()} · Nv.${charProg.level} · ❤️ ${stats.hp} · ⚔️ ${stats.atk} · 🛡️ ${stats.def}</p>
      <p class="view-desc">Arme : ${weaponLabel} · Équipe : ${1 + game.getActiveCompanionCount()}/3</p>
      <p class="combat-daily-banner">
        📅 Aujourd'hui — Combats rapides : <strong>${daily.remaining.soloMob}</strong>/${daily.limits.soloMob}
        · Boss rapides : <strong>${daily.remaining.soloBoss}</strong>/${daily.limits.soloBoss}
        · Donjons : <strong>${daily.remaining.dungeonRun}</strong>/${daily.limits.dungeonRun}
      </p>
    </div>
    ${ownedMeals.length > 0 ? `
      <div class="panel-inner meal-buff-panel">
        <h3>🍱 Repas avant donjon</h3>
        <p class="view-desc">Consommé au lancement d'un donjon — buff pour toute la run.</p>
        <div class="meal-options" id="meal-options">
          ${ownedMeals.map((mealId) => {
            const res = game.resources[mealId];
            const effect = getMealEffect(mealId);
            const selected = activeMeal === mealId ? ' selected' : '';
            return `<button type="button" class="meal-option-btn${selected}" data-meal="${mealId}">
              ${res?.emoji || '🍱'} ${res?.name || mealId}
              <span class="meal-effect-label">${effect?.label || ''}</span>
              <span class="meal-qty">×${game.state.inventory[mealId] || 0}</span>
            </button>`;
          }).join('')}
        </div>
        ${activeMeal ? `<button type="button" class="btn btn-muted btn-small" id="clear-meal">Retirer le repas sélectionné</button>` : ''}
      </div>
    ` : ''}
    ${showTutorialDungeon ? `
      <div class="panel-inner tutorial-dungeon-panel">
        <h3>🚪 Donjon de formation</h3>
        <p class="view-desc">Un donjon court (1 salle) pour tester ton arme en situation réelle. Équipe ton arme sur Personnage avant de commencer.</p>
        <button type="button" class="btn-tutorial btn-tutorial-dungeon" id="btn-tutorial-dungeon">
          Entrer dans le donjon
        </button>
        <p class="nickname-hint" id="tutorial-dungeon-hint"></p>
      </div>
    ` : ''}
    <div id="combat-zone-list"></div>
  `;

  el.querySelector('#clear-meal')?.addEventListener('click', () => game.clearActiveMealForRun());
  el.querySelectorAll('.meal-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (game.setActiveMealForRun(btn.dataset.meal)) {
        renderCombat(game, el);
      }
    });
  });

  if (showTutorialDungeon) {
    const weaponRef = game.state.combatEquipment?.weapon;
    const btn = el.querySelector('#btn-tutorial-dungeon');
    const hint = el.querySelector('#tutorial-dungeon-hint');
    if (!weaponRef) {
      btn.disabled = true;
      hint.textContent = 'Équipe ton arme sur Personnage avant le donjon.';
    }
    btn?.addEventListener('click', () => {
      const result = game.startTutorialDungeonRun();
      if (!result?.ok && result?.reason) showCombatResult(game, result);
    });
  }

  const list = el.querySelector('#combat-zone-list');

  for (const combatZone of Object.values(game.combatZones)) {
    const zone = game.balance.zones[combatZone.zone];
    const zoneUnlocked = game.isZoneUnlocked(combatZone.zone);
    const bossKills = game.state.bossKills?.[combatZone.id] || 0;
    const dungeonCheck = game.canEnterDungeonZone(combatZone.id);
    const dungeonUnlock = game.getDungeonUnlockProgress(combatZone.id);
    const roomCount = (combatZone.monsters?.length || 0) + (combatZone.boss ? 1 : 0);
    const killsRequired = dungeonCfg.killsPerMonster;

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
        <p class="view-desc">Donjon DQ : ${roomCount} salles à la suite, équipe à 3, HP conservés. Débloqué après entraînement rapide.</p>
        ${dungeonUnlock && !dungeonUnlock.ready ? `
          <ul class="combat-unlock-list">
            ${dungeonUnlock.monsterProgress.map((m) => `
              <li class="${m.met ? 'combat-unlock-done' : ''}">${m.emoji} ${m.name} : ${m.kills}/${m.required} victoires rapides</li>
            `).join('')}
            ${dungeonCfg.requireBossSoloKill && combatZone.boss ? `
              <li class="${dungeonUnlock.bossMet ? 'combat-unlock-done' : ''}">${combatZone.boss.emoji} Boss ${combatZone.boss.name} (rapide) : ${dungeonUnlock.bossSoloKills}/1</li>
            ` : ''}
          </ul>
        ` : ''}
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
      const monsterCheck = game.canStartFight(combatZone.id, false);
      const unlockMet = kills >= killsRequired;
      const row = document.createElement('div');
      row.className = 'combat-monster-row';
      row.innerHTML = `
        <div class="combat-monster-info">
          <span>${monster.emoji} ${monster.name}</span>
          <small class="combat-drops">${formatDropList(monster.drops, game.resources)}</small>
          <small class="${unlockMet ? 'combat-kill-ok' : ''}">${kills}/${killsRequired} pour donjon · ${kills} victoire${kills !== 1 ? 's' : ''} total</small>
        </div>
        <button type="button" class="btn btn-craft btn-fight" ${zoneUnlocked && monsterCheck.ok ? '' : 'disabled'} title="${monsterCheck.reason || ''}">Combattre</button>
      `;
      row.querySelector('.btn-fight')?.addEventListener('click', () => {
        const result = game.startCombatFight(combatZone.id, index, false);
        if (!result?.ok && result?.reason) showCombatResult(game, result);
      });
      monsterList.appendChild(row);
    });

    const boss = combatZone.boss;
    const bossCheck = game.canStartFight(combatZone.id, true);
    const bossSoloKills = game.state.combatKillStats?.[`boss_${boss.enemyId}`] || 0;
    const bossRow = document.createElement('div');
    bossRow.className = 'combat-monster-row combat-boss-row';
    bossRow.innerHTML = `
      <div class="combat-monster-info">
        <span>${boss.emoji} ${boss.name} <strong>(Boss)</strong></span>
        <small class="combat-drops">${formatDropList(boss.drops, game.resources)}</small>
        <small class="${bossSoloKills >= 1 ? 'combat-kill-ok' : ''}">Boss rapide : ${bossSoloKills}/1 pour donjon</small>
      </div>
      <button type="button" class="btn btn-prestige btn-fight-boss" ${zoneUnlocked && bossCheck.ok ? '' : 'disabled'} title="${bossCheck.reason || ''}">Boss</button>
    `;
    bossRow.querySelector('.btn-fight-boss')?.addEventListener('click', () => {
      const result = game.startCombatFight(combatZone.id, 0, true);
      if (!result?.ok && result?.reason) showCombatResult(game, result);
    });
    monsterList.appendChild(bossRow);

    list.appendChild(card);
  }
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
  const isTutorialFight = !!run.isTutorialFight;
  const isTutorialDungeon = !!run.isTutorialDungeon && isTutorialActive(game.state);
  const isSoloFight = !!run.isSoloFight || (!run.isDungeonRun && !isTutorialFight);
  const tutorialHint = isTutorialFight ? game.getTutorialCombatHint() : null;
  const allEnemies = combat?.enemies || [];
  const livingEnemies = getLivingEnemies(combat);
  const isPlayerTurn = combat?.phase === 'player';
  const isEnemyTurn = combat?.phase === 'enemy';
  const activeMember = game.getActiveCombatMember();
  const party = run.party || [];
  const isBoss = !!run.isBoss;
  const skills = game.getPlayerCombatSkills();
  const { attacks, spells } = splitSkillsByDqMenu(skills);
  const roomLabel = isTutorialFight
    ? '🎯 Entraînement · Mannequin'
    : isTutorialDungeon
      ? '🏰 Formation · Esprit novice (solo)'
      : run.isDungeonRun
      ? `Salle ${(run.roomIndex ?? 0) + 1}/${run.rooms?.length || '?'}${isBoss ? ' · 👑 Boss' : ''}`
      : `${isBoss ? '👑 Boss' : 'Entraînement'} · Équipe ${party.length} · ${livingEnemies.length} ennemi${livingEnemies.length !== 1 ? 's' : ''}`;

  const pendingSkillDef = combatUi.pendingSkill ? skills.find((s) => s.id === combatUi.pendingSkill) : null;
  const targetMode = combatUi.step === 'target' ? (combatUi.targetMode || getSkillTargetMode(pendingSkillDef)) : null;
  const canAct = isPlayerTurn && combatUi.step === 'action';

  const dungeonCombatHint = isTutorialDungeon
    ? getTutorialDungeonCombatHint(combatUi, { canAct, isPlayerTurn, targetMode })
    : null;

  const partyHtml = party.map((member, index) => {
    const hpPct = Math.max(0, (member.hp / member.maxHp) * 100);
    const isActive = isPlayerTurn && combat.activeMemberIndex === index && member.hp > 0;
    const isTargetable = targetMode === 'ally' && member.hp > 0;
    const tag = isTargetable ? 'button' : 'div';
    return `
      <${tag}${isTargetable ? ' type="button"' : ''} class="dq-party-member${isActive ? ' dq-active-fighter' : ''}${member.hp <= 0 ? ' dq-ko' : ''}${isTargetable ? ' dq-targetable' : ''}"
        ${isTargetable ? `data-target-id="${member.id}"` : ''}>
        <div class="dq-sprite dq-sprite-party" data-member-id="${member.id}" aria-hidden="true">${member.emoji}</div>
        <div class="dq-mini-hp" aria-hidden="true"><div class="dq-mini-hp-fill" style="width:${hpPct}%"></div></div>
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
        <div class="dq-enemy-label">${foe.name}</div>
        <div class="dq-mini-hp dq-mini-hp-enemy" aria-hidden="true"><div class="dq-mini-hp-fill" style="width:${hpPct}%"></div></div>
      </${tag}>
    `;
  }).join('');

  const partyStatusHtml = party.map((member) => {
    const hpPct = Math.max(0, (member.hp / member.maxHp) * 100);
    const isActive = isPlayerTurn && activeMember?.id === member.id;
    return `
      <div class="dq-status-chip${member.hp <= 0 ? ' dq-ko' : ''}${isActive ? ' dq-status-active' : ''}">
        <span class="dq-status-name">${member.emoji} ${member.name}</span>
        <div class="dq-status-hp"><div class="dq-status-hp-fill" style="width:${hpPct}%"></div></div>
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
    dialogue = `${activeMember?.emoji || '⚔️'} ${activeMember?.name || 'Héros'} — quelle attaque ?`;
  } else if (combatUi.menu === 'spells' && canAct) {
    dialogue = spells.length
      ? `${activeMember?.emoji || '✨'} ${activeMember?.name || 'Héros'} — quel sort ?`
      : 'Aucun sort disponible.';
  } else if (isTutorialDungeon && dungeonCombatHint?.text) {
    dialogue = dungeonCombatHint.text;
  } else if (isTutorialFight && tutorialHint?.signatureSkill && canAct) {
    dialogue = `${tutorialHint.roleLabel} : ton coup signature est ${tutorialHint.signatureSkill.emoji} ${tutorialHint.signatureSkill.name}. ${tutorialHint.signatureHint}`;
  } else if (isPlayerTurn && activeMember) {
    dialogue = `${activeMember.emoji} ${activeMember.name} se prépare au combat.`;
  } else {
    dialogue = getCombatDialogue(combat);
  }

  let commandHtml = '';
  if (isTutorialFight && canAct && combatUi.step === 'action') {
    const basic = attacks[0];
    const signature = spells.find((s) => s.id === tutorialHint?.signatureSkill?.id)
      || skills.find((s) => s.id === tutorialHint?.signatureSkill?.id);
    commandHtml = `
      ${basic ? `
        <button type="button" class="dq-cmd-btn dq-cmd-main" data-skill="${basic.id}">
          <span class="dq-cmd-icon">${basic.emoji}</span>
          <span class="dq-cmd-label">${basic.name}</span>
        </button>
      ` : ''}
      ${signature ? `
        <button type="button" class="dq-cmd-btn dq-cmd-main dq-cmd-signature" data-skill="${signature.id}">
          <span class="dq-cmd-icon">${signature.emoji}</span>
          <span class="dq-cmd-label">★ ${signature.name}</span>
        </button>
      ` : ''}
      <p class="dq-cmd-empty">Le mannequin n'attaque pas — teste ton coup signature !</p>
    `;
  } else if (combatUi.step === 'target') {
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-wide dq-target-cancel">◀ Annuler</button>
    `;
  } else if (combatUi.menu === 'attack' && canAct) {
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-back" data-menu="main">◀ Retour</button>
      ${attacks.map((skill) => `
        <button type="button" class="dq-cmd-btn" data-skill="${skill.id}">
          <span class="dq-cmd-icon">${skill.emoji}</span>
          <span class="dq-cmd-label">${skill.name}</span>
        </button>
      `).join('')}
    `;
  } else if (combatUi.menu === 'spells' && canAct) {
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-back" data-menu="main">◀ Retour</button>
      ${spells.length ? spells.map((skill) => `
        <button type="button" class="dq-cmd-btn" data-skill="${skill.id}">
          <span class="dq-cmd-icon">${skill.emoji}</span>
          <span class="dq-cmd-label">${skill.name}</span>
        </button>
      `).join('') : '<p class="dq-cmd-empty">Aucun sort pour l\'instant.</p>'}
    `;
  } else {
    commandHtml = `
      <button type="button" class="dq-cmd-btn dq-cmd-main" data-menu="attack" ${canAct ? '' : 'disabled'}>
        <span class="dq-cmd-icon">⚔️</span><span class="dq-cmd-label">Attaquer</span>
      </button>
      <button type="button" class="dq-cmd-btn dq-cmd-main" data-menu="spells" ${canAct && spells.length ? '' : 'disabled'}>
        <span class="dq-cmd-icon">✨</span><span class="dq-cmd-label">Sorts</span>
      </button>
      <button type="button" class="dq-cmd-btn dq-cmd-main btn-combat-defend" ${canAct ? '' : 'disabled'}>
        <span class="dq-cmd-icon">🛡️</span><span class="dq-cmd-label">Défense</span>
      </button>
      <button type="button" class="dq-cmd-btn dq-cmd-main btn-combat-flee" ${isTutorialFight || isTutorialDungeon ? 'disabled title="Pas de fuite pendant la formation"' : ''}>
        <span class="dq-cmd-icon">🏃</span><span class="dq-cmd-label">Fuir</span>
      </button>
    `;
  }

  const phaseLabel = isPlayerTurn ? 'Ton tour' : 'Tour ennemi';

  body.innerHTML = `
    <div class="dq-combat${isTutorialFight ? ' dq-tutorial-fight' : ''}${isTutorialDungeon ? ' dq-tutorial-dungeon' : ''}${isSoloFight ? ' dq-solo-fight' : ''}">
      <div class="dq-header">
        <span class="dq-zone-name">${isTutorialFight ? '🎯' : (combatZone?.emoji || '⚔️')} ${isTutorialFight ? 'Entraînement' : (combatZone?.name || 'Combat')}</span>
        <span class="dq-phase-badge">${phaseLabel}</span>
        <span class="dq-room">${roomLabel}</span>
      </div>
      ${isTutorialFight && tutorialHint ? `
        <div class="dq-tutorial-tip">
          <strong>${tutorialHint.roleLabel}</strong> · ${tutorialHint.roleShort}
          · Signature : ${tutorialHint.signatureSkill?.emoji || '⚔️'} ${tutorialHint.signatureSkill?.name || '—'}
        </div>
      ` : ''}
      ${isTutorialDungeon && dungeonCombatHint ? `
        <div class="dq-tutorial-combat-banner">
          <span class="dq-tutorial-combat-step">${dungeonCombatHint.step ? `Étape ${dungeonCombatHint.step}/3 · ` : ''}</span>
          <strong>Formation combat</strong>
          <span class="dq-tutorial-combat-text">${dungeonCombatHint.text}</span>
        </div>
      ` : ''}

      <div class="dq-battlefield${isBoss ? ' dq-boss-room' : ''}${targetMode === 'enemy' ? ' dq-pick-enemy' : ''}${isEnemyTurn ? ' dq-enemy-turn' : ''}">
        <div class="dq-sky"></div>
        <div class="dq-ground"></div>
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

  body.querySelector('.btn-combat-defend')?.addEventListener('click', () => {
    executeCombatTurn(game, body, () => game.useCombatDefend());
  });

  body.querySelector('.btn-combat-flee')?.addEventListener('click', () => {
    if (isTutorialFight || isTutorialDungeon) return;
    resetCombatUiTurn();
    game.abandonCombat();
    closeDungeonCombatModal();
  });

  if (isTutorialDungeon && dungeonCombatHint?.selector) {
    applyCombatTutorialFocus(body, dungeonCombatHint.selector);
  } else if (isTutorialDungeon) {
    clearCombatTutorialFocus();
  }
}

export function closeDungeonCombatModal() {
  clearCombatTutorialFocus();
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
    if (result.isTutorialFight) {
      body.innerHTML = `
        <h2>🎯 Entraînement réussi !</h2>
        <p class="modal-desc">Tu as testé ton coup signature. Passe aux vrais combats au Temple du Cerisier.</p>
        <div class="modal-gains">
          <div class="offline-gain-row">+${result.charXp || 0} XP personnage</div>
        </div>
        <button class="btn btn-modal-close" id="dungeon-close">Continuer</button>
      `;
    } else {
    let lootHtml = '';
    for (const [resId, amount] of Object.entries(result.drops || {})) {
      const res = game.resources[resId];
      lootHtml += `<div class="offline-gain-row">${renderResourceIcon(res, 'loot-icon')}+${amount} ${res?.name || resId}</div>`;
    }
    const title = result.isDungeon
      ? `🏰 Donjon terminé ! (${result.roomCount || ''} salles)`
      : `${result.isBoss ? '👑' : '🏆'} Victoire !`;
    body.innerHTML = `
      <h2>${title}</h2>
      <div class="modal-gains">
        <div class="offline-gain-row">+${result.charXp || 0} XP personnage</div>
        ${lootHtml || '<div class="offline-gain-row">Aucune pépite cette fois.</div>'}
      </div>
      ${result.levelResult ? `<p>🧘 Personnage Nv.${result.levelResult.level} !</p>` : ''}
      <button class="btn btn-modal-close" id="dungeon-close">Continuer</button>
    `;
    }
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
    if (game.isTutorialActive()) {
      requestAnimationFrame(() => renderTutorialOverlay(game));
    }
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
  for (let i = 0; i < 12; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.animationDuration = `${8 + Math.random() * 12}s`;
    petal.style.animationDelay = `${Math.random() * 10}s`;
    petal.style.opacity = `${0.3 + Math.random() * 0.4}`;
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
