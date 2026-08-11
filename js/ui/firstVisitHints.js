/**
 * First-visit contextual hints — one bubble per view, shown once.
 * Stores seen views in game.state.ui.seenHints.
 */

const HINTS = {
  job_farmer: {
    selector: '.production-units-grid .harvest-slot',
    text: '🌾 Touche une plante pour récolter ! Vends ensuite à la Place marchande.',
    position: 'bottom',
  },
  village_school: {
    selector: '.school-branch-tabs',
    text: '🏫 Choisis un onglet pour voir les recherches. Chaque branche débloque de nouveaux métiers ou fonctions.',
    position: 'bottom',
  },
  job_lumberjack: {
    selector: '.production-units-grid .harvest-slot',
    text: '🪓 Nouveau métier ! Récolte du bois comme tu faisais avec le blé.',
    position: 'bottom',
  },
  workshop: {
    selector: '.craft-job-tabs, .craft-recipe-list',
    text: '🛠️ Fabrique des outils ici. Un outil équipé accélère tes récoltes.',
    position: 'bottom',
  },
  combat: {
    selector: '.combat-zone-list, .combat-zones',
    text: '⚔️ Choisis un donjon et combats les monstres. Les victoires rapportent de l\'XP personnage.',
    position: 'bottom',
  },
  cuisine: {
    selector: '.cuisine-tabs',
    text: '👨‍🍳 Cuisine des repas pour te soigner en combat ou booster tes stats.',
    position: 'bottom',
  },
  inventory: {
    selector: '.bank-grid, .inventory-list',
    text: '💰 Ta banque de ressources. Vends ici pour gagner des Kirha.',
    position: 'top',
  },
  auction_house: {
    selector: '.merchant-grid, .merchant-list',
    text: '🏪 Achète et vends des ressources. Les prix changent !',
    position: 'top',
  },
};

function ensureHintState(state) {
  if (!state.ui) state.ui = {};
  if (!state.ui.seenHints) state.ui.seenHints = [];
  return state.ui.seenHints;
}

export function hasSeenHint(state, viewId) {
  return ensureHintState(state).includes(viewId);
}

export function markHintSeen(state, viewId) {
  const seen = ensureHintState(state);
  if (!seen.includes(viewId)) seen.push(viewId);
}

export function showFirstVisitHint(state, viewId, scheduleSave) {
  if (!HINTS[viewId]) return;
  if (hasSeenHint(state, viewId)) return;

  const hint = HINTS[viewId];

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = document.querySelector(hint.selector);
      if (!target) return;

      removeExistingHint();

      const bubble = document.createElement('div');
      bubble.className = `first-visit-hint fvh-${hint.position || 'bottom'}`;
      bubble.innerHTML = `
        <p class="fvh-text">${hint.text}</p>
        <button type="button" class="btn btn-small btn-muted fvh-dismiss">Compris ✓</button>
      `;

      bubble.querySelector('.fvh-dismiss').addEventListener('click', () => {
        bubble.classList.add('fvh-leaving');
        setTimeout(() => bubble.remove(), 300);
        markHintSeen(state, viewId);
        if (scheduleSave) scheduleSave();
      });

      target.style.position = target.style.position || 'relative';
      target.appendChild(bubble);

      requestAnimationFrame(() => bubble.classList.add('fvh-visible'));
    });
  });
}

function removeExistingHint() {
  document.querySelectorAll('.first-visit-hint').forEach((el) => el.remove());
}
