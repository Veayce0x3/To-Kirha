/**
 * Vue École du Village — recherches saisonnières + connaissances permanentes.
 */

import { formatResearchDuration } from '../systems/villageSchool.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';

let schoolProgressTimer = null;

function clearSchoolTimer() {
  if (schoolProgressTimer) {
    clearInterval(schoolProgressTimer);
    schoolProgressTimer = null;
  }
}

function statusLabel(status) {
  switch (status) {
    case 'done': return 'Terminée';
    case 'active': return 'En cours';
    case 'locked': return 'Prérequis';
    case 'blocked': return 'Une autre recherche est en cours';
    case 'unaffordable': return 'Ressources insuffisantes';
    case 'available': return 'Disponible';
    default: return '';
  }
}

function formatBonusSummary(bonuses) {
  const lines = [];
  if (bonuses.cuisineJobXp) lines.push(`+${Math.round(bonuses.cuisineJobXp * 100)} % XP Cuisine`);
  if (bonuses.mealSellBonus) lines.push(`+${Math.round(bonuses.mealSellBonus * 100)} % vente repas`);
  if (bonuses.farmXp) lines.push(`+${Math.round(bonuses.farmXp * 100)} % XP ferme`);
  if (bonuses.farmCycleSpeed) lines.push(`−${Math.round(bonuses.farmCycleSpeed * 100)} % cycles ferme`);
  if (bonuses.toolDurability) lines.push(`+${Math.round(bonuses.toolDurability * 100)} % durabilité outils`);
  if (bonuses.merchantChanceBonus) lines.push(`Marchand +${Math.round(bonuses.merchantChanceBonus * 100)} pts`);
  if (bonuses.extraHarvestSlot) lines.push(`+${bonuses.extraHarvestSlot} emplacement récolte`);
  if (bonuses.combatMpFlat) lines.push(`+${bonuses.combatMpFlat} PM`);
  if (bonuses.combatHpFlat) lines.push(`+${bonuses.combatHpFlat} PV`);
  if (bonuses.combatHp) lines.push(`+${Math.round(bonuses.combatHp * 100)} % PV`);
  if (bonuses.combatMp) lines.push(`+${Math.round(bonuses.combatMp * 100)} % PM`);
  if (bonuses.combatAtk) lines.push(`+${Math.round(bonuses.combatAtk * 100)} % ATQ`);
  if (bonuses.combatDef) lines.push(`+${Math.round(bonuses.combatDef * 100)} % DEF`);
  return lines;
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
        <p class="feature-locked-badge">🔒 Se débloque avec l’Outilleur</p>
        <p class="view-desc feature-locked-hint">${vm.unlockHint || 'Débloque l’Outilleur pour ouvrir l’École.'}</p>
      </div>
    `;
    return;
  }

  const bonusLines = formatBonusSummary(vm.bonuses || {});
  const active = vm.active;
  const activeHtml = active
    ? `
      <div class="school-active panel-inner">
        <strong>📖 ${active.research.name}</strong>
        <div class="xp-bar-container school-progress-bar" aria-label="Progression recherche">
          <div class="xp-bar" style="width:${Math.round(active.progress * 100)}%"></div>
        </div>
        <span class="school-active-eta">${formatResearchDuration(active.remainingMs)} restantes</span>
      </div>`
    : `
      <div class="school-active idle panel-inner">
        <span>Aucune recherche en cours — choisis une étude ci-dessous.</span>
      </div>`;

  const branchesHtml = (vm.branches || []).map(({ branch, items }) => {
    const cards = items.map(({ research, status, ingredients, canStart }) => {
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
        <article class="school-card status-${status}${research.tier === 'permanent' ? ' permanent' : ''}" data-research="${research.id}">
          <header class="school-card-head">
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
    }).join('');

    return `
      <section class="school-branch">
        <h3 class="school-branch-title">${branch.emoji || ''} ${branch.label}</h3>
        <div class="school-card-list">${cards}</div>
      </section>`;
  }).join('');

  el.innerHTML = `
    <div class="school-view">
      <header class="view-header">
        <h2><span class="nav-emoji">🏫</span> École du Village</h2>
        <p class="view-desc">Recherches de saison (reset à la Renaissance) et connaissances permanentes. Les legs préparent la saison suivante.</p>
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
      ${branchesHtml}
    </div>
  `;

  el.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-start');
      const result = game.startVillageSchoolResearch(id);
      if (!result?.ok) {
        // toast via event éventuel ; message local
        btn.textContent = result?.reason || 'Impossible';
        setTimeout(() => { btn.textContent = 'Lancer'; }, 1800);
      }
    });
  });

  if (active) {
    schoolProgressTimer = setInterval(() => {
      if (!el.isConnected) {
        clearSchoolTimer();
        return;
      }
      const done = game.tickVillageSchool();
      if (done?.ok || !el.isConnected) {
        clearSchoolTimer();
        if (el.isConnected) renderVillageSchool(game, el);
        return;
      }
      const prog = game.getVillageSchoolView?.()?.active;
      const bar = el.querySelector('.school-progress-bar .xp-bar');
      const eta = el.querySelector('.school-active-eta');
      if (prog && bar) bar.style.width = `${Math.round(prog.progress * 100)}%`;
      if (prog && eta) eta.textContent = `${formatResearchDuration(prog.remainingMs)} restantes`;
    }, 1000);
  }
}
