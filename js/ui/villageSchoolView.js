/**
 * Vue École du Village — branches en onglets + liste verticale un-par-un.
 */

import { formatResearchDuration, checkHarvestUnitsPairProgress } from '../systems/villageSchool.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';
import { getView } from './router.js';

let schoolProgressTimer = null;
let schoolBranchTab = null;

export function clearSchoolTimer() {
  if (schoolProgressTimer) {
    clearInterval(schoolProgressTimer);
    schoolProgressTimer = null;
  }
}

function isSchoolViewMounted(el) {
  return getView() === 'village_school' && !!el?.isConnected;
}

function statusLabel(status) {
  switch (status) {
    case 'done': return 'Terminée';
    case 'active': return 'En cours';
    case 'locked': return 'Verrouillée';
    case 'blocked': return 'Une autre recherche est en cours';
    case 'unaffordable': return 'Ressources insuffisantes';
    case 'available': return 'Disponible';
    default: return '';
  }
}

function formatBonusSummary(bonuses, state = null) {
  const lines = [];
  if (bonuses.cuisineJobXp) lines.push(`+${Math.round(bonuses.cuisineJobXp * 100)} % XP Cuisine`);
  if (bonuses.mealSellBonus) lines.push(`+${Math.round(bonuses.mealSellBonus * 100)} % vente repas`);
  if (bonuses.farmXp) lines.push(`+${Math.round(bonuses.farmXp * 100)} % XP ferme`);
  if (bonuses.farmCycleSpeed) lines.push(`−${Math.round(bonuses.farmCycleSpeed * 100)} % cycles ferme`);
  if (bonuses.toolDurability) lines.push(`+${Math.round(bonuses.toolDurability * 100)} % durabilité outils`);
  if (bonuses.merchantChanceBonus) lines.push(`Marchand +${Math.round(bonuses.merchantChanceBonus * 100)} pts`);
  if (bonuses.extraHarvestSlot) lines.push(`+${bonuses.extraHarvestSlot} emplacement récolte`);
  if (bonuses.extraWellUnits) lines.push(`+${bonuses.extraWellUnits} emplacement(s) Puits`);
  if (state?.villageSchool?.unlockedHarvestAll) lines.push('Tout récolter (récolte)');
  if (bonuses.combatMpFlat) lines.push(`+${bonuses.combatMpFlat} PM`);
  if (bonuses.combatHpFlat) lines.push(`+${bonuses.combatHpFlat} PV`);
  if (bonuses.combatHp) lines.push(`+${Math.round(bonuses.combatHp * 100)} % PV`);
  if (bonuses.combatMp) lines.push(`+${Math.round(bonuses.combatMp * 100)} % PM`);
  if (bonuses.combatAtk) lines.push(`+${Math.round(bonuses.combatAtk * 100)} % ATQ`);
  if (bonuses.combatDef) lines.push(`+${Math.round(bonuses.combatDef * 100)} % DEF`);
  return lines;
}

function researchDepth(research, byId, memo = {}) {
  if (!research) return 0;
  if (memo[research.id] != null) return memo[research.id];
  const reqs = research.requires || [];
  if (!reqs.length) {
    memo[research.id] = 0;
    return 0;
  }
  let max = 0;
  for (const id of reqs) {
    max = Math.max(max, researchDepth(byId[id], byId, memo));
  }
  memo[research.id] = max + 1;
  return memo[research.id];
}

/** Déblocages feuille de route avant bonus saisonniers (évite « Nichoir » avant « Puits »). */
function isOptionalWellExpansion(research) {
  return !!(research?.effect?.permanent?.extraWellUnits);
}

function isRoadmapUnlockResearch(research) {
  const e = research?.effect || {};
  return !!(
    e.unlockGatheringJob
    || e.unlockFarmBuilding
    || e.unlockCombat
    || e.unlockCombatZone
    || e.unlockVillageBoard
    || e.unlockCraftJob
  );
}

function roadmapPriority(research) {
  if (isRoadmapUnlockResearch(research)) return 0;
  // Emplacements Puits optionnels : après les vrais déblocages (ex. Poulailler)
  if (isOptionalWellExpansion(research)) return 1;
  if (research?.tier === 'permanent') return 2;
  return 3;
}

function isActionableSchoolItem(it) {
  return it.status === 'available'
    || it.status === 'unaffordable'
    || it.status === 'blocked';
}

/** Affiche : terminées, actives, prochains choix parallèles (ex. Poulailler + 2ᵉ Puits), + teaser. */
function filterBranchItemsForDisplay(items) {
  const byId = Object.fromEntries(items.map((it) => [it.research.id, it.research]));
  const depths = {};
  for (const it of items) researchDepth(it.research, byId, depths);

  const sorted = [...items].sort((a, b) => {
    const pa = roadmapPriority(a.research);
    const pb = roadmapPriority(b.research);
    if (pa !== pb) return pa - pb;
    const oa = Number(a.research.order) || 999;
    const ob = Number(b.research.order) || 999;
    if (oa !== ob) return oa - ob;
    const d = (depths[a.research.id] || 0) - (depths[b.research.id] || 0);
    if (d !== 0) return d;
    return String(a.research.id).localeCompare(String(b.research.id));
  });

  const done = sorted.filter((it) => it.status === 'done');
  const active = sorted.filter((it) => it.status === 'active');
  const actionable = sorted.filter(isActionableSchoolItem);
  const primaryNext = actionable.filter((it) => !isOptionalWellExpansion(it.research));
  const wellNext = actionable.filter((it) => isOptionalWellExpansion(it.research));
  // Choix parallèles : tous les déblocages dispo + le prochain slot Puits (optionnel)
  const nextBatch = [...primaryNext];
  if (wellNext[0]) nextBatch.push(wellNext[0]);

  const anchorId = active[0]?.research?.id || nextBatch[0]?.research?.id || null;
  let fog = null;
  if (anchorId) {
    fog = sorted.find((it) => (
      it.status === 'locked'
      && (it.research.requires || []).includes(anchorId)
    )) || null;
  }
  if (!fog && !nextBatch.length && !active.length) {
    fog = sorted.find((it) => it.status === 'locked') || null;
  }

  const out = [...done];
  if (active.length) out.push(...active);
  else if (nextBatch.length) out.push(...nextBatch);
  if (fog && !out.some((it) => it.research.id === fog.research.id)) out.push(fog);
  return out;
}

/** Catalogue recherches + branches pour libellés de prérequis croisés. */
function getSchoolCatalog(game) {
  const data = game.villageSchoolData || {};
  return {
    researches: data.researches || {},
    branches: data.branches || {},
  };
}

function isResearchDoneInState(state, researchId) {
  const s = state?.villageSchool;
  if (!s || !researchId) return false;
  return (s.completedPermanent || []).includes(researchId)
    || (s.completedSeasonal || []).includes(researchId);
}

/** Prérequis manquants avec nom + onglet (ex. « Sentiers du bûcheron (🌾 Récolte) »). */
function formatMissingPrereqs(research, game, catalog) {
  const reqs = research?.requires || [];
  if (!reqs.length) return [];
  const lines = [];
  for (const id of reqs) {
    if (isResearchDoneInState(game.state, id)) continue;
    const def = catalog.researches[id];
    const branch = def ? catalog.branches[def.branch] : null;
    const name = def?.name || id;
    const branchBit = branch
      ? ` (${[branch.emoji, branch.label].filter(Boolean).join(' ')})`
      : '';
    lines.push(`${name}${branchBit}`);
  }
  return lines;
}

function formatProgressPrereq(research, game) {
  const p = research?.requiresProgress;
  if (!p) return null;
  if (p.type === 'harvestUnitsPair') {
    const check = checkHarvestUnitsPairProgress(
      game.state,
      game.resources,
      Number(p.currentUnits) || 6,
      Number(p.nextUnits) || 3
    );
    if (check.ok) return null;
    return p.hint || check.hint || 'Progression récolte insuffisante';
  }
  return p.hint || null;
}

function renderTreeNode(game, item, catalog) {
  const { research, status, ingredients, canStart } = item;

  if (status === 'locked') {
    const missing = formatMissingPrereqs(research, game, catalog);
    const progressHint = formatProgressPrereq(research, game);
    const bits = [...missing];
    if (progressHint) bits.push(progressHint);
    const prereqHtml = bits.length
      ? `<p class="school-prereq">🔒 Prérequis : <strong>${bits.join(' · ')}</strong></p>`
      : `<p class="school-prereq">🔒 Prérequis : termine l’étude précédente</p>`;
    const costPreview = [
      research.kirhaCost ? `${research.kirhaCost} 💰` : null,
      ...Object.entries(research.ingredients || {}).map(([resId, need]) => {
        const res = game.resources?.[resId];
        const icon = res ? renderResourceIcon(res, 'school-ing-icon') : '';
        return `${icon}${need}`;
      }),
    ].filter(Boolean);
    return `
      <article class="school-tree-node fog status-locked" data-research="${research.id}">
        <header class="school-tree-node-head">
          <h4>${research.name}</h4>
          <span class="school-tier">${research.tier === 'permanent' ? 'Permanent' : 'Saison'}</span>
        </header>
        <p class="school-card-effect">${research.effectLabel || 'Suite du chemin'}</p>
        ${prereqHtml}
        ${costPreview.length
          ? `<div class="school-card-cost school-cost-preview">${costPreview.join(' · ')} <span class="school-cost-preview-note">(aperçu)</span></div>`
          : ''}
      </article>`;
  }

  if (status === 'done') {
    return `
      <article class="school-tree-node status-done school-node-done" data-research="${research.id}">
        <header class="school-tree-node-head">
          <h4>✅ ${research.name}</h4>
          <span class="school-tier">${research.tier === 'permanent' ? 'Permanent' : 'Saison'}</span>
        </header>
        <p class="school-card-effect">${research.effectLabel || 'Bonus actif'}</p>
        <p class="school-card-meta school-done-badge">Terminée</p>
      </article>`;
  }

  const costParts = [
    research.kirhaCost ? `${research.kirhaCost} 💰` : null,
    ...ingredients.map((ing) => {
      const ok = ing.have >= ing.need;
      const icon = game.resources[ing.resId]
        ? renderResourceIcon(game.resources[ing.resId], 'school-ing-icon')
        : (ing.emoji || '');
      return `<span class="school-ing${ok ? '' : ' missing'}">${icon}${ing.have}/${ing.need}</span>`;
    }),
  ].filter(Boolean);

  return `
    <article class="school-tree-node status-${status}${research.tier === 'permanent' ? ' permanent' : ''}" data-research="${research.id}">
      <header class="school-tree-node-head">
        <h4>${research.name}</h4>
        <span class="school-tier">${research.tier === 'permanent' ? 'Permanent' : 'Saison'}</span>
      </header>
      <p class="school-card-desc">${research.description || ''}</p>
      <p class="school-card-effect">${research.effectLabel || ''}</p>
      <p class="school-card-meta">${formatResearchDuration(research.durationMs)} · ${statusLabel(status)}</p>
      <div class="school-card-cost">${costParts.join(' · ')}</div>
      ${canStart
        ? `<button type="button" class="btn btn-craft school-start-btn" data-start="${research.id}">Lancer</button>`
        : ''}
    </article>`;
}

export function renderVillageSchool(game, el) {
  clearSchoolTimer();
  const vm = game.getVillageSchoolView?.();
  if (!vm) {
    el.innerHTML = `<p class="view-desc">École indisponible.</p>`;
    return;
  }

  if (!vm.unlocked) {
    el.innerHTML = `
      <div class="feature-locked-panel school-locked">
        <div class="feature-locked-icon"><span class="nav-emoji" style="font-size:2.5rem">🏫</span></div>
        <h2>École du Village</h2>
        <p class="view-desc feature-locked-hint">${vm.unlockHint || 'Feuille de route du village.'}</p>
      </div>
    `;
    return;
  }

  const branches = vm.branches || [];
  if (!schoolBranchTab || !branches.some((b) => b.branch.id === schoolBranchTab)) {
    schoolBranchTab = branches[0]?.branch?.id || null;
  }

  const bonusLines = formatBonusSummary(vm.bonuses || {}, game.state);
  const active = vm.active;
  const pct = active ? Math.round(active.progress * 100) : 0;
  const activeHtml = active
    ? `
      <div class="school-active school-timer-banner panel-inner" role="status" aria-live="polite">
        <div class="school-timer-head">
          <strong class="school-timer-title">📖 Recherche en cours</strong>
          <span class="school-timer-countdown" data-school-countdown>${formatResearchDuration(active.remainingMs)}</span>
        </div>
        <p class="school-timer-name">${active.research.name}</p>
        <div class="xp-bar-container school-progress-bar" aria-label="Progression recherche">
          <div class="xp-bar" style="width:${pct}%"></div>
        </div>
        <span class="school-active-eta">${pct}&nbsp;% · <span data-school-eta>${formatResearchDuration(active.remainingMs)} restantes</span></span>
      </div>`
    : `
      <div class="school-active idle panel-inner">
        <span>Aucune recherche en cours — choisis une branche puis une étude.</span>
      </div>`;

  const tabsHtml = branches.map(({ branch, items }) => {
    const doneCount = items.filter((it) => it.status === 'done').length;
    const total = items.length;
    const activeBranch = schoolBranchTab === branch.id;
    return `
      <button type="button" class="char-tab-btn${activeBranch ? ' active' : ''}"
        data-school-branch="${branch.id}" role="tab" aria-selected="${activeBranch}">
        ${branch.emoji || ''} ${branch.label}
        <span class="school-tab-count">${doneCount}/${total}</span>
      </button>`;
  }).join('');

  const current = branches.find((b) => b.branch.id === schoolBranchTab) || branches[0];
  const catalog = getSchoolCatalog(game);
  const displayItems = current ? filterBranchItemsForDisplay(current.items) : [];
  const listHtml = displayItems.map((it) => renderTreeNode(game, it, catalog)).join('')
    || '<p class="view-desc">Aucune recherche dans cette branche.</p>';

  el.innerHTML = `
    <div class="school-view">
      <header class="view-header">
        <h2><span class="nav-emoji">🏫</span> École du Village</h2>
        <p class="view-desc">Feuille de route : métiers, atelier, ferme et donjons. Les prérequis d’autres onglets sont indiqués clairement.</p>
      </header>
      <div class="school-summary panel-inner">
        <span>${vm.seasonalCount} saisonnière(s) · ${vm.permanentCount} permanente(s)</span>
        ${bonusLines.length
          ? `<ul class="school-bonus-list">${bonusLines.map((l) => `<li>${l}</li>`).join('')}</ul>`
          : '<p class="school-bonus-empty">Aucun bonus actif pour l’instant.</p>'}
        ${vm.seasonFlags?.merchantFirstWeek
          ? '<p class="school-flag">🧳 Legs actif : marchand garanti le jour du début de saison</p>'
          : ''}
      </div>
      ${activeHtml}
      <nav class="school-branch-tabs char-tabs cuisine-tabs" role="tablist" aria-label="Branches de recherche">
        ${tabsHtml}
      </nav>
      <section class="school-branch school-vertical-list" data-branch="${current?.branch?.id || ''}">
        <p class="school-tree-legend">Étapes terminées en compact · une seule étude active ou disponible à la fois.</p>
        <div class="school-vertical">${listHtml}</div>
      </section>
    </div>
  `;

  el.querySelectorAll('[data-school-branch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      schoolBranchTab = btn.getAttribute('data-school-branch');
      renderVillageSchool(game, el);
    });
  });

  el.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-start');
      const result = game.startVillageSchoolResearch(id);
      if (!result?.ok) {
        btn.textContent = result?.reason || 'Impossible';
        setTimeout(() => { btn.textContent = 'Lancer'; }, 1800);
        return;
      }
      renderVillageSchool(game, el);
    });
  });

  if (active) {
    schoolProgressTimer = setInterval(() => {
      // el = #view-container : reste connecté après navigation — vérifier la vue active
      if (!isSchoolViewMounted(el)) {
        clearSchoolTimer();
        return;
      }
      const done = game.tickVillageSchool();
      if (done?.ok) {
        clearSchoolTimer();
        if (isSchoolViewMounted(el)) renderVillageSchool(game, el);
        return;
      }
      if (!isSchoolViewMounted(el)) {
        clearSchoolTimer();
        return;
      }
      const prog = game.getVillageSchoolView?.()?.active;
      const bar = el.querySelector('.school-progress-bar .xp-bar');
      const etaWrap = el.querySelector('.school-active-eta');
      const countdown = el.querySelector('[data-school-countdown]');
      const p = prog ? Math.round(prog.progress * 100) : 0;
      const rem = prog ? formatResearchDuration(prog.remainingMs) : '';
      if (prog && bar) bar.style.width = `${p}%`;
      if (prog && countdown) countdown.textContent = rem;
      if (prog && etaWrap) {
        etaWrap.innerHTML = `${p}&nbsp;% · <span data-school-eta>${rem} restantes</span>`;
      }
    }, 1000);
  }
}
