/**
 * First-visit contextual hints — one bubble per view, shown once.
 * Stores seen views in game.state.ui.seenHints.
 */

const HINTS = {
  job_farmer: {
    selector: '.production-units-grid',
    text: '🌾 Touche une plante pour récolter ! Vends ensuite à la Place marchande pour gagner des Kirha.',
    position: 'bottom',
  },
  village_school: {
    selector: '.school-branch-tabs',
    text: '🏫 Choisis un onglet (Récolte, Atelier, Combat…). Chaque branche débloque de nouveaux métiers ou fonctions.',
    position: 'bottom',
  },
  job_lumberjack: {
    selector: '.production-units-grid',
    text: '🪓 Nouveau métier ! Récolte du bois comme tu faisais avec le blé.',
    position: 'bottom',
  },
  job_fisher: {
    selector: '.production-units-grid',
    text: '🎣 Pêche des poissons pour l\'XP et les ressources. Même principe que les autres métiers.',
    position: 'bottom',
  },
  job_miner: {
    selector: '.production-units-grid',
    text: '⛏️ Extrais des minerais ! La repousse est un peu plus longue mais les ressources sont précieuses.',
    position: 'bottom',
  },
  workshop: {
    selector: '.panel-inner',
    text: '🛠️ Fabrique des outils ici pour accélérer tes récoltes. Ils s\'équipent automatiquement.',
    position: 'bottom',
  },
  combat: {
    selector: '.panel-inner',
    text: '⚔️ Choisis un donjon et combats les monstres. Les victoires donnent de l\'XP personnage et du loot.',
    position: 'bottom',
  },
  cuisine: {
    selector: '.panel-inner',
    text: '👨‍🍳 Cuisine des repas pour te soigner en combat ou booster tes stats temporairement.',
    position: 'bottom',
  },
  inventory: {
    selector: '.panel-inner',
    text: '💰 Ton stock de ressources. Pour vendre, va à la Place marchande dans le menu.',
    position: 'top',
  },
  auction_house: {
    selector: '.panel-inner',
    text: '🏪 Vends tes ressources ici pour gagner des Kirha, ou achète ce qu\'il te manque.',
    position: 'top',
  },
  farm_chicken_coop: {
    selector: '.panel-inner',
    text: '🐔 Nourris tes poules pour produire des œufs. L\'animal a une durée de vie limitée — rachète-en un quand il est fatigué.',
    position: 'bottom',
  },
  farm_well: {
    selector: '.panel-inner',
    text: '💧 Le puits produit de l\'eau, un ingrédient pour d\'autres bâtiments. Pas d\'XP ici mais c\'est essentiel !',
    position: 'bottom',
  },
  guide: {
    selector: '.panel-inner',
    text: '📖 Ta feuille de route ! Chaque étape se coche automatiquement quand tu la complètes.',
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

      target.classList.add('fvh-anchor');
      target.appendChild(bubble);

      requestAnimationFrame(() => bubble.classList.add('fvh-visible'));
    });
  });
}

function removeExistingHint() {
  document.querySelectorAll('.first-visit-hint').forEach((el) => el.remove());
  document.querySelectorAll('.fvh-anchor').forEach((el) => el.classList.remove('fvh-anchor'));
}
