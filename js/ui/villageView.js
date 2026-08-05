/**
 * Vue Village — Ciel du jour (météo) + Panneau du village (quêtes).
 */

import { navigate } from './router.js';
import { emit } from '../core/events.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';
import {
  WEATHER_META,
  WEATHER_IDS,
  DISCOVERY_META,
} from '../systems/harvestEvents.js';
import { formatUtcResetLabel } from '../systems/villageBoard.js';

function formatNumber(n) {
  const x = Number(n) || 0;
  if (x >= 10_000) return `${(x / 1_000).toFixed(1)}K`;
  return Math.round(x).toLocaleString('fr-FR');
}

function pillarLabel(pillar) {
  switch (pillar) {
    case 'harvest': return 'Récolte';
    case 'farm': return 'Ferme';
    case 'cooking': return 'Cuisine';
    case 'combat': return 'Combat';
    default: return pillar || '';
  }
}

function progressLabel(card) {
  const q = card.quest;
  if (!q) return '';
  if (q.type === 'deliver') {
    return card.deliverParts
      .map((p) => `${formatNumber(p.have)}/${formatNumber(p.need)} ${p.name}`)
      .join(' · ');
  }
  if (q.type === 'combat_kills') return `${card.progress.current}/${card.progress.target} créatures`;
  if (q.type === 'combat_bosses') return `${card.progress.current}/${card.progress.target} boss`;
  if (q.type === 'combat_dungeons') return `${card.progress.current}/${card.progress.target} donjon(s)`;
  return `${card.progress.current}/${card.progress.target}`;
}

export function renderVillage(game, el) {
  game.ensureVillageBoardDay?.();
  const weatherStatus = game.getHarvestEventsStatus?.();
  const w = weatherStatus?.weather || game.getCurrentWeather?.();
  const board = game.getVillageBoardView?.();
  const jobName = game.jobs[w?.jobId]?.name || w?.jobId || '';
  const discovery = DISCOVERY_META[w?.discoveryId];
  const resetLabel = formatUtcResetLabel();

  const weatherPills = WEATHER_IDS.map((id) => {
    const meta = WEATHER_META[id];
    const active = meta.id === w?.id;
    return `<span class="village-weather-pill${active ? ' active' : ''}" title="${meta.label}">${meta.emoji}</span>`;
  }).join('');

  const mix = board?.mixCounts || {};
  const rewardLine = 'Récompenses selon la difficulté de chaque quête · bonus 5/5';

  const cardsHtml = (board?.cards || []).map((card, idx) => {
    const q = card.quest;
    const npc = card.npc;
    const diff = card.difficulty;
    const statusClass = card.completed ? ' done' : (card.locked ? ' locked' : (card.canTurnIn ? ' ready' : ''));
    const deliverIcons = (card.deliverParts || []).map((p) => {
      const res = game.resources[p.resId];
      return `<span class="village-quest-mat">${renderResourceIcon(res, 'village-quest-mat-icon') || p.emoji || ''} ${formatNumber(Math.min(p.have, p.need))}/${formatNumber(p.need)}</span>`;
    }).join('');
    const rewardHint = diff
      ? `${formatNumber(diff.kirhaMin)}–${formatNumber(diff.kirhaMax)} 💰${diff.nuggets ? ` + ${diff.nuggets} pépite` : ''}`
      : '';

    return `
      <article class="village-quest-card${statusClass}" data-quest="${q?.id || ''}">
        <header class="village-quest-head">
          <span class="village-quest-npc">${npc?.emoji || '👤'}</span>
          <div>
            <strong>${npc?.name || 'Villageois'}</strong>
            <span class="village-quest-title">${npc?.title || ''}</span>
          </div>
          <span class="village-quest-pillar">${diff?.emoji || ''} ${diff?.label || ''}${card.isJoker ? ' · Joker' : ''} · ${pillarLabel(q?.pillar)}</span>
        </header>
        <p class="village-quest-msg">${q?.message || ''}</p>
        <div class="village-quest-progress">
          ${card.locked
            ? `<span class="village-quest-lock">🔒 ${card.lockHint || 'Verrouillé'}</span>`
            : (q?.type === 'deliver' ? deliverIcons : `<span>${progressLabel(card)}</span>`)}
        </div>
        ${rewardHint && !card.completed ? `<p class="village-quest-reward">${rewardHint}</p>` : ''}
        <footer class="village-quest-foot">
          ${card.completed
            ? `<span class="village-quest-done">✓ ${npc?.thanks || 'Terminé'}</span>`
            : `<button type="button" class="btn btn-craft btn-village-turnin" data-quest="${q?.id || ''}" ${card.canTurnIn ? '' : 'disabled'}>
                ${card.locked ? 'Verrouillé' : (card.canTurnIn ? 'Livrer' : 'En cours')}
              </button>`}
        </footer>
      </article>
    `;
  }).join('');

  el.innerHTML = `
    <div class="view-header">
      <h2>🏘️ Village</h2>
      <p class="view-desc">Météo du jour & panneau des villageois · reset 00:00 UTC</p>
    </div>

    <section class="village-sky panel-inner">
      <div class="village-sky-top">
        <div class="village-sky-hero">
          <span class="village-sky-emoji">${w?.emoji || '☀️'}</span>
          <div>
            <h3 class="village-sky-title">${w?.label || 'Météo'}</h3>
            <p class="village-sky-line">Découvertes Kirha : <strong>${jobName}</strong>${discovery ? ` · « ${discovery.label} »` : ''}</p>
            <p class="village-sky-reset">Prochain ciel dans ${resetLabel}</p>
          </div>
        </div>
        <div class="village-sky-pills">${weatherPills}</div>
      </div>
      <div class="village-sky-caps" aria-label="Limites événements récolte">
        <span title="Brillants ressource">✨ ${weatherStatus?.shiny?.used ?? 0}/${weatherStatus?.shiny?.cap ?? 10}</span>
        <span title="Jackpots">🎰 ${weatherStatus?.jackpot?.used ?? 0}/${weatherStatus?.jackpot?.cap ?? 1}</span>
        <span title="Découvertes Kirha">💰 ${weatherStatus?.kirha?.used ?? 0}/${weatherStatus?.kirha?.cap ?? 3}</span>
      </div>
    </section>

    <section class="village-board panel-inner">
      <div class="village-board-head">
        <div>
          <h3>📋 Panneau du village</h3>
          <p class="view-desc">🟢 ${mix.easy || 0} facile(s) · 🟠 ${mix.medium || 0} moyen(s) · 🔴 ${mix.hard || 0} difficile · ${board?.doneCount || 0}/${board?.total || 0} terminée(s)</p>
        </div>
        <div class="village-board-reward">
          <span>${rewardLine}</span>
          ${board?.allDone
            ? `<span class="village-board-clear">${board.claimedClearBonus ? 'Bonus 5/5 récupéré' : '5/5 !'}</span>`
            : ''}
        </div>
      </div>
      <div class="village-quest-list">
        ${cardsHtml || '<p class="empty-text">Aucune quête aujourd’hui.</p>'}
      </div>
    </section>
  `;

  el.querySelectorAll('.btn-village-turnin').forEach((btn) => {
    btn.addEventListener('click', () => {
      const questId = btn.getAttribute('data-quest');
      const result = game.turnInVillageQuest(questId);
      if (!result?.ok) {
        emit('farmBlocked', { message: result?.reason || 'Impossible.' });
        return;
      }
      emit('villageQuestComplete', result);
      renderVillage(game, el);
    });
  });
}

/** Mini pastille météo sur les vues récolte → lien Village. */
export function buildWeatherMiniChip(game) {
  const w = game.getCurrentWeather?.();
  if (!w) return '';
  const jobName = game.jobs[w.jobId]?.name || '';
  return `
    <button type="button" class="harvest-weather-chip" id="goto-village-weather" title="Voir le Village">
      <span>${w.emoji}</span>
      <span>${w.label}</span>
      <span class="harvest-weather-chip-job">${jobName}</span>
    </button>
  `;
}

export function bindWeatherMiniChip(el) {
  el?.querySelector('#goto-village-weather')?.addEventListener('click', () => navigate('village'));
}
