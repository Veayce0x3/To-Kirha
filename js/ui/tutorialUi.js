import { navigate, JOB_VIEW_MAP, VIEWS, getView } from './router.js';
import {
  checkTutorialWeaponEquipped,
  findTutorialWeaponOwnedRef,
  getChosenTutorialRecipeId,
} from '../systems/tutorialSandbox.js';
import { resolveItem } from '../systems/combat.js';
import { emit } from '../core/events.js';

let spotlightTarget = null;
let spotlightSelector = null;
let spotlightRaf = null;
let spotlightScrollBound = false;
let hintElements = [];

const CRAFT_TAB_LABEL = {
  toolmaker: 'Outilleur',
  blacksmith: 'Forgeron',
  carver: 'Sculpteur',
  armorer: 'Armurier',
  tailor: 'Tailleur',
  shoemaker: 'Cordonnier',
  jeweler: 'Bijoutier',
  cook: 'Cuisinier',
};

const HINT_CLASS = 'tutorial-hint';
const TUTORIAL_BTN_CLASS = 'btn-tutorial';

function isTutorialInteractive(el) {
  return el?.matches?.(
    '.btn, .btn-craft, .nav-btn, .burger-btn, .workshop-tab, .char-tab-btn, .dq-cmd-btn, .picker-toggle, .bank-row, .btn-sell, .btn-sell-all, .craft-tile, .link-btn, .farm-feed-btn'
  );
}

function stripTutorialBtnClass(el) {
  el?.classList?.remove(TUTORIAL_BTN_CLASS);
}

const BRAND_LOGO = './asset%20to-kirha/icone%20application%20/icone%20application.jpg';

const NAV_HINTS = {
  job_lumberjack: { finger: '👆 BÛCHERON', label: 'Bûcheron' },
  workshop: { finger: '👆 ATELIER', label: 'Atelier' },
  cuisine: { finger: '👆 CUISINE', label: 'Cuisine' },
  character: { finger: '👆 PERSO', label: 'Perso' },
  combat: { finger: '👆 COMBAT', label: 'Combat' },
  auction_house: { finger: '👆 HDV', label: 'Hôtel des Ventes' },
  inventory: { finger: '👆 BANQUE', label: 'Banque' },
  farm_well: { finger: '👆 PUITS', label: 'Puits' },
  farm_chicken_coop: { finger: '👆 POULAILLER', label: 'Poulailler' },
  farm_barn: { finger: '👆 ÉTABLE', label: 'Étable' },
  farm_sheepfold: { finger: '👆 BERGERIE', label: 'Bergerie' },
  farm_pigsty: { finger: '👆 PORCHERIE', label: 'Porcherie' },
  farm_beehive: { finger: '👆 RUCHES', label: 'Ruches' },
};

let combatHintEl = null;

export function clearCombatTutorialFocus() {
  if (combatHintEl) {
    combatHintEl.classList.remove(HINT_CLASS);
    stripTutorialBtnClass(combatHintEl);
    combatHintEl = null;
  }
  document.getElementById('dungeon-combat-body')
    ?.querySelectorAll(`.${HINT_CLASS}`)
    .forEach((el) => {
      el.classList.remove(HINT_CLASS);
      stripTutorialBtnClass(el);
    });
}

export function applyCombatTutorialFocus(container, selector) {
  clearCombatTutorialFocus();
  if (!container || !selector) return;

  const el = container.querySelector(selector);
  if (!el) return;

  el.classList.add(HINT_CLASS);
  if (isTutorialInteractive(el)) {
    el.classList.add(TUTORIAL_BTN_CLASS);
  }
  combatHintEl = el;
}

function isTutorialDungeonCombatOpen(game) {
  const modal = document.getElementById('dungeon-combat-modal');
  if (!modal?.classList.contains('active')) return false;
  const enc = game.getActiveCombat()?.encounter;
  return !!enc?.isTutorialDungeon && game.isTutorialActive();
}

function isSidebarOpen() {
  return document.getElementById('sidebar')?.classList.contains('open') ?? false;
}

function openTutorialSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('active');
}

function closeTutorialSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

function resolveNavMicroHint(targetView, title, stepPrefix = '') {
  const meta = NAV_HINTS[targetView] || {
    finger: '👆 MENU',
    label: getNavLabel(targetView),
  };
  const mobile = isMobileNav();

  if (!mobile) {
    return {
      selector: navSelector(targetView),
      title,
      text: `${stepPrefix}Touche « ${meta.label} » dans le menu à gauche.`,
      finger: meta.finger,
    };
  }

  if (!isSidebarOpen()) {
    openTutorialSidebar();
  }

  const navSel = navSelector(targetView);
  if (isSidebarOpen() && queryTarget(navSel)) {
    return {
      selector: navSel,
      title,
      text: `${stepPrefix}Touche « ${meta.label} » dans le menu.`,
      finger: meta.finger,
    };
  }

  return {
    selector: '#burger-btn',
    title,
    text: `${stepPrefix}Touche ☰ pour ouvrir le menu, puis « ${meta.label} ».`,
    finger: '👆 MENU',
  };
}

function tutorialModalShell(stepLabel, title, innerHtml, actionsHtml = '') {
  return `
    <div class="tutorial-modal-shell">
      <header class="tutorial-modal-brand">
        <img class="brand-logo" src="${BRAND_LOGO}" alt="" width="36" height="36" />
        <span class="tutorial-modal-step">${stepLabel}</span>
        <h2 class="tutorial-modal-title">${title}</h2>
      </header>
      <div class="tutorial-modal-content">
        ${innerHtml}
      </div>
      ${actionsHtml ? `<div class="tutorial-modal-actions">${actionsHtml}</div>` : ''}
    </div>
  `;
}

function queryTarget(selector) {
  if (!selector) return null;
  if (selector.includes(',')) {
    for (const part of selector.split(',')) {
      const el = document.querySelector(part.trim());
      if (el && el.getClientRects().length > 0) return el;
    }
    return null;
  }
  const itemModal = document.getElementById('item-modal');
  if (itemModal?.classList.contains('active')) {
    const inModal = itemModal.querySelector(selector);
    if (inModal) return inModal;
  }
  const root = document.getElementById('view-container');
  return root?.querySelector(selector) || document.querySelector(selector);
}

function clearAllHints() {
  if (spotlightTarget) {
    spotlightTarget.classList.remove('tutorial-highlight');
    spotlightTarget = null;
  }
  spotlightSelector = null;
  hintElements.forEach((el) => {
    el.classList.remove(HINT_CLASS);
    stripTutorialBtnClass(el);
  });
  hintElements = [];
  document.querySelectorAll(`.${HINT_CLASS}`).forEach((el) => {
    if (!el.closest('#dungeon-combat-modal')) {
      el.classList.remove(HINT_CLASS);
      stripTutorialBtnClass(el);
    }
  });
}

function scheduleSpotlightUpdate() {
  if (spotlightRaf) return;
  spotlightRaf = requestAnimationFrame(() => {
    spotlightRaf = null;
    const hole = document.getElementById('tutorial-spotlight-hole');
    if (spotlightSelector && hole) {
      applySpotlightRect(hole, spotlightSelector, false);
    }
  });
}

function bindSpotlightScroll() {
  if (spotlightScrollBound) return;
  spotlightScrollBound = true;
  window.addEventListener('scroll', scheduleSpotlightUpdate, true);
  window.addEventListener('resize', scheduleSpotlightUpdate);
}

function unbindSpotlightScroll() {
  if (!spotlightScrollBound) return;
  spotlightScrollBound = false;
  window.removeEventListener('scroll', scheduleSpotlightUpdate, true);
  window.removeEventListener('resize', scheduleSpotlightUpdate);
  if (spotlightRaf) {
    cancelAnimationFrame(spotlightRaf);
    spotlightRaf = null;
  }
}

function applySpotlightRect(hole, selector, scrollIntoView) {
  const el = queryTarget(selector);
  if (!el || !hole) {
    if (hole) hole.style.display = 'none';
    return null;
  }

  if (scrollIntoView) {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const rect = el.getBoundingClientRect();
  const pad = 8;
  hole.style.display = 'block';
  hole.style.top = `${Math.max(0, rect.top - pad)}px`;
  hole.style.left = `${Math.max(0, rect.left - pad)}px`;
  hole.style.width = `${rect.width + pad * 2}px`;
  hole.style.height = `${rect.height + pad * 2}px`;
  return el;
}

function markHint(el) {
  if (!el || el.classList.contains(HINT_CLASS)) return;
  el.classList.add(HINT_CLASS);
  if (isTutorialInteractive(el)) {
    el.classList.add(TUTORIAL_BTN_CLASS);
  }
  hintElements.push(el);
}

function applyTutorialFocus(selector) {
  clearAllHints();
  if (!selector) return;

  if (selector.includes('nav-btn') && isMobileNav()) {
    openTutorialSidebar();
  }

  spotlightSelector = selector;
  const hole = document.getElementById('tutorial-spotlight-hole');
  const el = applySpotlightRect(hole, selector, true);
  if (!el) {
    spotlightSelector = null;
    return;
  }

  markHint(el);
  el.classList.add('tutorial-highlight');
  spotlightTarget = el;

  if (selector.includes('combat-owned') || selector.includes('tutorial-equip')) {
    document.querySelector('.char-owned-details')?.setAttribute('open', '');
  }

  bindSpotlightScroll();
}

function isMobileNav() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function getNavLabel(viewId) {
  if (viewId?.startsWith('workshop_')) return 'Atelier';
  if (viewId === 'cuisine') return 'Cuisine';
  if (viewId?.startsWith('farm_')) return NAV_HINTS[viewId]?.label || 'Ferme';
  return VIEWS[viewId]?.label || viewId;
}

function navSelector(viewId) {
  if (viewId?.startsWith('workshop_')) return '.nav-btn[data-view="workshop"]';
  if (viewId === 'cuisine') return '.nav-btn[data-view="cuisine"]';
  if (viewId?.startsWith('farm_')) return `.nav-btn[data-view="${viewId}"]`;
  return `.nav-btn[data-view="${viewId}"]`;
}

function isEquipmentTabActive() {
  return !!document.querySelector('.char-tab-btn[data-tab="equipment"].active');
}

function resolveEquipMicroHint(game, mobile) {
  const state = game.state;
  const recipes = game.recipes;
  const combatItems = game.combatEquipment.items;
  const recipeId = getChosenTutorialRecipeId(state);
  const recipe = recipeId ? recipes[recipeId] : null;
  const weaponName = recipe?.name || 'ton arme de formation';
  const combatItemId = recipe?.combatItem;
  const tutorialRef = findTutorialWeaponOwnedRef(state, recipes, combatItems);

  if (checkTutorialWeaponEquipped(state, recipes, combatItems)) {
    game.syncTutorialInventory();
    return {
      selector: null,
      title: 'Équipe ton arme',
      text: '✅ Parfait ! Ton arme est équipée — on continue…',
      finger: '✅',
    };
  }

  if (mobile && getView() !== 'character') {
    return resolveNavMicroHint('character', 'Équipe ton arme', '④ ');
  }
  if (getView() !== 'character') {
    return {
      selector: navSelector('character'),
      title: 'Équipe ton arme',
      text: '④ Touche « Perso » dans le menu à gauche.',
      finger: '👆 PERSO',
    };
  }
  if (!isEquipmentTabActive()) {
    return {
      selector: '.char-tab-btn[data-tab="equipment"]',
      title: 'Équipe ton arme',
      text: '⑤ Touche l\'onglet « Équipement ».',
      finger: '👆 ÉQUIPEMENT',
    };
  }

  const weaponSlotRef = state.combatEquipment?.weapon;
  const weaponSlotItem = weaponSlotRef ? resolveItem(state, weaponSlotRef, combatItems) : null;
  const wrongWeaponOnSlot = weaponSlotItem && combatItemId && weaponSlotItem.id !== combatItemId;

  if (wrongWeaponOnSlot) {
    return {
      selector: '#combat-slots [data-combat-slot="weapon"].filled .btn-small',
      title: 'Équipe ton arme',
      text: `⑥ Sur la ligne « Arme », touche « Retirer », puis équipe « ${weaponName} » en dessous.`,
      finger: '👆 RETIRER',
    };
  }

  if (tutorialRef) {
    const safeRef = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(tutorialRef)
      : tutorialRef.replace(/"/g, '\\"');
    const btnSel = `#combat-owned [data-tutorial-equip-ref="${safeRef}"]`;
    if (queryTarget(btnSel)) {
      return {
        selector: btnSel,
        title: 'Équipe ton arme',
        text: `⑥ Ouvre « Pièces possédées » et touche le bouton pour « ${weaponName} ».`,
        finger: '👆 ÉQUIPER',
      };
    }
    if (state.combatEquipment?.weapon === tutorialRef) {
      game.syncTutorialInventory();
      return {
        selector: null,
        title: 'Équipe ton arme',
        text: '✅ Parfait ! Ton arme est équipée — on continue…',
        finger: '✅',
      };
    }
  }

  const craftJob = recipe?.craftJob || 'blacksmith';
  const craftLabel = CRAFT_TAB_LABEL[craftJob] || 'Forgeron';
  if (!currentViewStartsWithWorkshop()) {
    return resolveNavMicroHint('workshop', 'Forge ton arme', '');
  }
  if (craftJob && !isWorkshopTabActive(craftJob)) {
    return {
      selector: `.workshop-tab[data-craft-job="${craftJob}"]`,
      title: 'Forge ton arme',
      text: `Touche l'onglet « ${craftLabel} » en haut de l'écran.`,
      finger: `👆 ${craftLabel.toUpperCase()}`,
    };
  }
  return {
    selector: '#craft-available .btn-craft:not([disabled]), #craft-panels .affordable .btn-craft:not([disabled])',
    title: 'Forge ton arme',
    text: `Touche « ${craftLabel} » puis « Fabriquer » pour « ${weaponName} ».`,
    finger: '👆 FABRIQUER',
  };
}

function currentViewStartsWithWorkshop() {
  return getView().startsWith('workshop');
}

function isWorkshopTabActive(craftJob) {
  if (!craftJob) return false;
  return !!document.querySelector(`.workshop-tab[data-craft-job="${craftJob}"].active`);
}

function isBlockingGameModalOpen(ui) {
  const blocking = ['dungeon-result-modal', 'dungeon-combat-modal', 'offline-modal', 'prestige-modal'];
  if (blocking.some((id) => document.getElementById(id)?.classList.contains('active'))) return true;
  if (document.getElementById('item-modal')?.classList.contains('active')) {
    return ui?.stepId !== 'sell_wood';
  }
  return false;
}

function hideTutorialSpotlight() {
  clearAllHints();
  document.getElementById('tutorial-spotlight-hole')?.style.setProperty('display', 'none');
  document.getElementById('tutorial-overlay')?.classList.add('hidden');
}

/**
 * Retourne la micro-étape actuelle : une seule action claire à la fois.
 */
function resolveMicroHint(ui, currentView, game) {
  const craftJob = ui.targetCraftJob;
  const craftLabel = craftJob ? CRAFT_TAB_LABEL[craftJob] : 'Forgeron';
  const mobile = isMobileNav();

  if (ui.stepId === 'harvest') {
    if (currentView !== 'job_lumberjack') {
      return resolveNavMicroHint('job_lumberjack', 'Récolte', '① ');
    }
    const slot0 = game?.state?.harvestSlots?.lumberjack?.[0];
    if (!slot0?.resourceId) {
      return {
        selector: '.slots-grid .picker-toggle',
        title: 'Récolte',
        text: '② Choisis le Frêne dans le menu déroulant.',
        finger: '👆 CHOISIR',
      };
    }
    return {
      selector: '.slots-grid .btn-harvest-compact:not([disabled]), .slots-grid .harvest-slot .btn-start:not([disabled])',
      title: 'Récolte',
      text: '② Touche le bouton violet « Récolter ».',
      finger: '👆 RÉCOLTER',
    };
  }

  if (ui.stepId === 'sell_wood') {
    if (document.getElementById('item-modal')?.classList.contains('active')) {
      return {
        selector: '#modal-sell-1, #modal-sell-all',
        title: 'Vendre ton Frêne',
        text: 'Touche « Vendre 1 » ou « Vendre tout » pour obtenir des 💰.',
        finger: '👆 VENDRE',
      };
    }
    if (currentView !== 'inventory') {
      return resolveNavMicroHint('inventory', 'Vendre au marché', '③ ');
    }
    const hasFrene = (game?.state?.inventory?.frene || 0) > 0;
    if (hasFrene) {
      return {
        selector: '.bank-row[data-resource-id="frene"]',
        title: 'Vendre au marché',
        text: '③ Touche la ligne Frêne dans le tableau.',
        finger: '👆 FRÊNE',
      };
    }
    return {
      selector: '.bank-resource-list',
      title: 'Vendre au marché',
      text: 'Ouvre la Banque et vends ton Frêne.',
      finger: '👆 BANQUE',
    };
  }

  if (ui.stepId === 'craft_axe') {
    return null;
  }

  if (ui.stepId === 'farm') {
    if (game?.state?.tutorial?.flags?.farmStarted) {
      return {
        selector: null,
        title: 'Production lancée',
        text: '✅ Parfait ! Ta ferme produit — on continue…',
        finger: '✅',
      };
    }
    if (currentView !== 'farm_well') {
      return resolveNavMicroHint('farm_well', 'La Ferme', '⑥ ');
    }
    const wellActive = game?.state?.farmSlots?.well?.[0]?.active;
    if (wellActive) {
      return {
        selector: null,
        title: 'Production lancée',
        text: '✅ Parfait ! Le Puits produit de l\'eau — on continue…',
        finger: '✅',
      };
    }
    const farmBtn = queryTarget('#tutorial-farm-start-well');
    if (farmBtn) {
      return {
        selector: '#tutorial-farm-start-well',
        title: 'Puits',
        text: '⑥ Touche le bouton violet pour lancer la production d\'eau.',
        finger: '👆 PRODUIRE',
      };
    }
    return {
      selector: '.farm-slot[data-building="well"][data-slot="0"] .btn-start',
      title: 'Puits',
      text: '⑥ Touche le bouton violet pour lancer la production d\'eau.',
      finger: '👆 PRODUIRE',
    };
  }

  if (ui.stepId === 'farm_chicken') {
    if (game?.state?.tutorial?.flags?.farmChickenStarted) {
      return {
        selector: null,
        title: 'Œufs en cours',
        text: '✅ Parfait ! Le Poulailler produit — on continue…',
        finger: '✅',
      };
    }
    if (currentView !== 'farm_chicken_coop') {
      return resolveNavMicroHint('farm_chicken_coop', 'Le Poulailler', '⑦ ');
    }
    const slot = game?.state?.farmSlots?.chicken_coop?.[0];
    if (slot?.active) {
      return {
        selector: null,
        title: 'Œufs en cours',
        text: '✅ Parfait ! Le Poulailler produit — on continue…',
        finger: '✅',
      };
    }
    if (slot && !slot.feedId) {
      const feedBtn = queryTarget('.farm-slot[data-building="chicken_coop"] .farm-feed-btn[data-feed="ble"]');
      if (feedBtn) {
        return {
          selector: '.farm-slot[data-building="chicken_coop"] .farm-feed-btn[data-feed="ble"]',
          title: 'Ration',
          text: '⑦ Touche « Blé » pour choisir la ration (2 Blé + 1 Eau).',
          finger: '👆 BLÉ',
        };
      }
    }
    const chickenBtn = queryTarget('#tutorial-farm-start-chicken');
    if (chickenBtn) {
      return {
        selector: '#tutorial-farm-start-chicken',
        title: 'Poulailler',
        text: '⑦ Touche le bouton violet pour lancer la production d\'œufs.',
        finger: '👆 PRODUIRE',
      };
    }
    return {
      selector: '.farm-slot[data-building="chicken_coop"][data-slot="0"] .btn-start',
      title: 'Poulailler',
      text: '⑦ Choisis une ration puis touche « Produire ».',
      finger: '👆 PRODUIRE',
    };
  }

  if (ui.stepId === 'craft') {
    if (ui.craftPhase === 'equip' || ui.craftEquipPhase) {
      return resolveEquipMicroHint(game, mobile);
    }
    if (ui.craftPhase === 'craft' || game?.state?.tutorial?.flags?.weaponChosen) {
      if (game && getChosenTutorialRecipeId(game.state)) {
        const recipeId = getChosenTutorialRecipeId(game.state);
        const recipe = game.recipes[recipeId];
        if (recipe && game.state.tutorial?.flags?.weaponCrafted) {
          return resolveEquipMicroHint(game, mobile);
        }
      }
      if (!currentView.startsWith('workshop')) {
        return resolveNavMicroHint('workshop', 'Forge ton arme', '① ');
      }
      if (craftJob && !isWorkshopTabActive(craftJob)) {
        return {
          selector: `.workshop-tab[data-craft-job="${craftJob}"]`,
          title: 'Forge ton arme',
          text: `② Touche l'onglet « ${craftLabel} » en haut de l'écran.`,
          finger: `👆 ${craftLabel.toUpperCase()}`,
        };
      }
      const chosenId = getChosenTutorialRecipeId(game?.state);
      if (chosenId) {
        const specificBtn = queryTarget(`.craft-tile[data-recipe-id="${chosenId}"] .btn-craft:not([disabled])`);
        if (specificBtn) {
          return {
            selector: `.craft-tile[data-recipe-id="${chosenId}"] .btn-craft:not([disabled])`,
            title: 'Forge ton arme',
            text: '③ Touche « Fabriquer » sur ton arme.',
            finger: '👆 FABRIQUER',
          };
        }
      }
      return {
        selector: '#craft-available .btn-craft:not([disabled]), #craft-panels .affordable .btn-craft:not([disabled]), #workshop-content',
        title: 'Forge ton arme',
        text: '③ Touche le gros bouton « Fabriquer » sur ton arme.',
        finger: '👆 FABRIQUER',
      };
    }
  }

  if (ui.stepId === 'dungeon') {
    if (currentView !== 'combat') {
      return resolveNavMicroHint('combat', 'Donjon d\'entraînement', '');
    }
    return {
      selector: '#btn-tutorial-dungeon:not([disabled])',
      title: 'Donjon d\'entraînement',
      text: 'Touche le bouton « Entrer dans le donjon ».',
      finger: '👆 DONJON',
    };
  }

  if (ui.stepId === 'scrolls') {
    if (currentView !== 'auction_house') {
      return resolveNavMicroHint('auction_house', 'Parchemins', '');
    }
    const hasScrollBtn = queryTarget('.auction-buy-row .btn-buy-scroll:not([disabled]), .auction-buy-row .btn:not([disabled])');
    if (!hasScrollBtn) {
      return {
        selector: '.auction-tip .link-btn, #goto-bank',
        title: 'Gagner des Kirha',
        text: 'Vends des récoltes à la Banque si tu manques de 💰, puis reviens acheter un parchemin.',
        finger: '👆 BANQUE',
      };
    }
    return {
      selector: '.auction-buy-row .btn-buy-scroll:not([disabled]), .auction-buy-row .btn:not([disabled])',
      title: 'Parchemins',
      text: 'Achète au moins 1 parchemin avec tes Kirha.',
      finger: '👆 ACHETER',
    };
  }

  return {
    selector: ui.highlight,
    title: ui.title,
    text: ui.text,
    finger: '👆 ICI',
  };
}

function getSigPreview(game, role) {
  const sig = role?.signatureSkill ? game.combatSkills[role.signatureSkill] : null;
  return sig ? `${sig.emoji} ${sig.name}` : '—';
}

function renderAxeOfferModal(game, container, ui) {
  if (container.querySelector('#tutorial-accept-axe')) return;

  const recipe = game.recipes.sakura_axe;
  const stepLabel = ui ? `Formation ${ui.stepNumber}/${ui.stepTotal}` : 'Formation';

  container.innerHTML = tutorialModalShell(
    stepLabel,
    '🪓 Ta première hache',
    `
      <p class="tutorial-modal-desc">Pour récolter du bois efficacement, tu as besoin d'une hache. Celle-ci t'est <strong>offerte</strong> pour la formation.</p>
      <div class="tutorial-weapon-single tutorial-hint">
        <span class="tutorial-weapon-emoji">${recipe?.emoji || '🪓'}</span>
        <div class="tutorial-weapon-single-main">
          <strong>${recipe?.name || 'Hache de Frêne'}</strong>
          <p class="tutorial-weapon-craft-hint">Palier 1 · 25 utilisations · équipée automatiquement</p>
        </div>
      </div>
    `,
    '<button type="button" class="btn-tutorial" id="tutorial-accept-axe">Recevoir ma hache</button>',
  );
}

function handleTutorialAxeAccept(game, e) {
  e.preventDefault();
  e.stopPropagation();
  if (!game.acceptTutorialAxe()) {
    emit('tutorialAxeError', { reason: 'Impossible de valider l\'étape — réessaie ou recharge avec ?newgame=1' });
    return;
  }
  hideTutorialModal();
  requestAnimationFrame(() => renderTutorialOverlay(game));
}

function renderTutorialWeaponOffer(game, container) {
  const offer = game.getTutorialStarterWeaponOffer();
  const role = offer.role;
  const recipe = offer.recipe;
  const sig = getSigPreview(game, role);
  const ui = game.getTutorialUi();

  container.innerHTML = tutorialModalShell(
    ui ? `Formation ${ui.stepNumber}/${ui.stepTotal}` : 'Formation',
    '⚔️ Arme de débutant',
    `
      <p class="tutorial-modal-desc">Tu commences en <strong>${role?.label || 'Chevalier'}</strong> — style polyvalent, idéal pour apprendre le combat.</p>
      <div class="tutorial-weapon-single tutorial-hint">
        <span class="tutorial-weapon-emoji">${recipe?.emoji || '⚔️'}</span>
        <div class="tutorial-weapon-single-main">
          <strong>${recipe?.name || 'Lame du débutant'}</strong>
          <span class="tutorial-weapon-role">${role?.role || ''}</span>
          <span class="tutorial-weapon-sig">Signature : ${sig}</span>
          <p class="tutorial-weapon-craft-hint">Matériaux fournis : 5× Frêne, 3× Blé — forge à l'Atelier ensuite.</p>
        </div>
      </div>
    `,
    '<button type="button" class="btn-tutorial" id="tutorial-accept-weapon">Accepter cette arme</button>',
  );
  container.querySelector('#tutorial-accept-weapon')?.addEventListener('click', () => {
    if (!game.acceptTutorialStarterWeapon()) return;
    hideTutorialModal();
    requestAnimationFrame(() => renderTutorialOverlay(game));
  });
}

function renderStarterAxeModal(game, container) {
  const recipe = game.recipes.tutorial_starter_axe;
  const ui = game.getTutorialUi();
  const alreadyEquipped = game.state.tutorial?.flags?.starterAxeEquipped;

  container.innerHTML = tutorialModalShell(
    ui ? `Formation ${ui.stepNumber}/${ui.stepTotal}` : 'Formation',
    '🪓 Hache du débutant',
    `
      <p class="tutorial-modal-desc">Cette hache de formation te permet de récolter du bois (10 utilisations, palier 1).</p>
      <div class="tutorial-weapon-single tutorial-hint">
        <span class="tutorial-weapon-emoji">${recipe?.emoji || '🪓'}</span>
        <div class="tutorial-weapon-single-main">
          <strong>${recipe?.name || 'Hache du débutant'}</strong>
          <p class="tutorial-weapon-craft-hint">Ensuite, fabrique une Hache de Frêne durable à l'Outilleur.</p>
        </div>
      </div>
    `,
    alreadyEquipped
      ? '<button type="button" class="btn-tutorial" id="tutorial-starter-axe-done">Continuer</button>'
      : '<button type="button" class="btn-tutorial" id="tutorial-equip-starter-axe">Équiper la hache</button>',
  );

  if (alreadyEquipped) {
    container.querySelector('#tutorial-starter-axe-done')?.addEventListener('click', () => {
      hideTutorialModal();
      requestAnimationFrame(() => renderTutorialOverlay(game));
    });
    return;
  }

  container.querySelector('#tutorial-equip-starter-axe')?.addEventListener('click', () => {
    if (!game.doEquip('tutorial_starter_axe')) return;
    hideTutorialModal();
    requestAnimationFrame(() => renderTutorialOverlay(game));
  });
}

function renderWeaponGallery(game, container) {
  renderTutorialWeaponOffer(game, container);
}

function renderNicknameModal(game, container) {
  const maxLen = game.characterConfig.nicknameMaxLength || 20;
  const ui = game.getTutorialUi();

  container.innerHTML = tutorialModalShell(
    ui ? `Formation ${ui.stepNumber}/${ui.stepTotal}` : 'Formation',
    '🌸 Choisis ton pseudo',
    `
      <p class="tutorial-modal-desc">Avant de commencer la formation, donne un nom à ton personnage. Tu pourras le renommer plus tard (payant).</p>
      <div class="nickname-form tutorial-nickname-form">
        <label class="nickname-label" for="tutorial-nickname-input">Ton pseudo</label>
        <input id="tutorial-nickname-input" class="nickname-input" type="text" maxlength="${maxLen}" placeholder="Ex. Kira le Bûcheron" autocomplete="nickname" />
        <p class="nickname-hint">Lettres, chiffres, espaces, tirets — max ${maxLen} caractères.</p>
      </div>
    `,
    '<button type="button" class="btn-tutorial" id="tutorial-nickname-confirm">Valider mon pseudo</button>',
  );

  const input = container.querySelector('#tutorial-nickname-input');
  input?.focus();

  const submit = () => {
    const result = game.setCharacterNickname(input?.value || '', false, { silent: true });
    if (!result.ok) {
      if (result.reason) emit('nicknameError', { reason: result.reason });
      return;
    }
    if (!game.completeTutorialNicknameStep()) return;
    hideTutorialModal();
    requestAnimationFrame(() => {
      if (game.shouldShowTutorialIntro()) {
        showTutorialIntroModal(game);
      } else {
        scheduleTutorialOverlayRefresh(game);
      }
    });
  };

  container.querySelector('#tutorial-nickname-confirm')?.addEventListener('click', submit);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
}

function renderIntroModal(game, container) {
  container.innerHTML = tutorialModalShell(
    'Formation',
    '🌸 Formation du village',
    `
      <p class="tutorial-modal-desc">On va te montrer pas à pas où cliquer. C'est simple !</p>
      <ul class="tutorial-modal-list">
        <li>🪓 Recevoir ta hache de bûcheron</li>
        <li>💰 Vendre à la Banque</li>
        <li>🪣 Découvrir la Ferme</li>
        <li>⚔️ Recevoir ton arme de débutant</li>
        <li>🔨 Forger et équiper</li>
        <li>🚪 Combattre en donjon</li>
        <li>📜 Acheter un parchemin</li>
      </ul>
    `,
    `
      <button type="button" class="btn-tutorial" id="tutorial-start">Commencer la formation</button>
      <button type="button" class="btn-tutorial" id="tutorial-skip-intro">Passer pour l'instant</button>
    `,
  );
  container.querySelector('#tutorial-start')?.addEventListener('click', () => {
    game.beginTutorial();
    hideTutorialModal();
    requestAnimationFrame(() => renderTutorialOverlay(game));
  });
  container.querySelector('#tutorial-skip-intro')?.addEventListener('click', () => {
    if (window.confirm('Passer la formation ? Tu pourras la revoir dans Options.')) {
      game.dismissTutorial();
      hideTutorialModal();
      teardownTutorialOverlay();
    }
  });
}

function renderGraduateModal(game, container) {
  const ui = game.getTutorialUi();
  container.innerHTML = tutorialModalShell(
    ui ? `Formation ${ui.stepNumber}/${ui.stepTotal}` : 'Formation',
    '🌸 Bravo, tu as réussi !',
    '<p class="tutorial-modal-desc">Tu sais récolter, forger, combattre et acheter. Bienvenue à Kirha !</p>',
    '<button type="button" class="btn-tutorial" id="tutorial-finish">Continuer l\'aventure</button>',
  );
  container.querySelector('#tutorial-finish')?.addEventListener('click', () => {
    game.graduateTutorial();
    hideTutorialModal();
    teardownTutorialOverlay();
    navigate('missions');
  });
}

export function showTutorialDungeonVictory(game, result) {
  const modal = document.getElementById('tutorial-modal');
  const body = document.getElementById('tutorial-modal-body');
  if (!modal || !body) return;

  hideTutorialSpotlight();
  document.getElementById('dungeon-result-modal')?.classList.remove('active');

  const ui = game.getTutorialUi();
  body.innerHTML = tutorialModalShell(
    ui ? `Étape ${ui.stepNumber}/${ui.stepTotal}` : 'Formation',
    '🚪 Donjon réussi !',
    `
      <p class="tutorial-modal-desc">Tu as vaincu le donjon de formation. Bien joué !</p>
      <ul class="tutorial-modal-list">
        <li>✅ +${result.charXp || 0} XP personnage</li>
        ${result.levelResult ? `<li>🧘 Personnage Nv.${result.levelResult.level}</li>` : ''}
      </ul>
    `,
    '<button type="button" class="btn-tutorial" id="tutorial-dungeon-done">Continuer</button>',
  );

  modal.classList.add('active');
  document.body.classList.add('tutorial-modal-open');
  document.body.classList.add('tutorial-active');

  body.querySelector('#tutorial-dungeon-done')?.addEventListener('click', () => {
    hideTutorialModal();
    requestAnimationFrame(() => renderTutorialOverlay(game));
  });
}

export function showTutorialIntroModal(game) {
  const modal = document.getElementById('tutorial-modal');
  const body = document.getElementById('tutorial-modal-body');
  if (!modal || !body) return;
  const ui = game.getTutorialUi();
  if (ui?.isNickname) {
    renderNicknameModal(game, body);
  } else {
    renderIntroModal(game, body);
  }
  modal.classList.add('active');
  document.body.classList.add('tutorial-modal-open');
}

export function hideTutorialModal() {
  const body = document.getElementById('tutorial-modal-body');
  if (body) body.innerHTML = '';
  document.getElementById('tutorial-modal')?.classList.remove('active');
  document.body.classList.remove('tutorial-modal-open');
}

/** Amène le joueur sur la vue de l'étape (Atelier Outilleur, Banque, etc.). */
function ensureTutorialNavigation(ui) {
  const target = ui?.hintView || ui?.targetView;
  if (!target || ui?.screen) return;

  if (ui.stepId === 'sell_wood' && document.getElementById('item-modal')?.classList.contains('active')) {
    return;
  }

  const current = getView();
  if (current === target) {
    lastTutorialNavKey = `${ui.stepId}:${target}`;
    return;
  }

  if (target.startsWith('workshop')) {
    if (target.startsWith('workshop_')) {
      const craftJob = target.replace('workshop_', '');
      if (current.startsWith('workshop') && isWorkshopTabActive(craftJob)) {
        lastTutorialNavKey = `${ui.stepId}:${target}`;
        return;
      }
    }
    if (!current.startsWith('workshop')) {
      const navKey = `${ui.stepId}:${target}`;
      if (lastTutorialNavKey === navKey) return;
      lastTutorialNavKey = navKey;
      navigate(target === 'workshop' ? 'workshop' : target);
      return;
    }
    if (target.startsWith('workshop_') && current !== target) {
      const navKey = `${ui.stepId}:${target}`;
      if (lastTutorialNavKey === navKey) return;
      lastTutorialNavKey = navKey;
      navigate(target);
    }
    return;
  }

  const navKey = `${ui.stepId}:${target}`;
  if (lastTutorialNavKey === navKey) return;
  lastTutorialNavKey = navKey;
  navigate(target);
}

let overlayRefreshToken = 0;
let lastTutorialNavKey = null;
let lastTutorialStepId = null;

export function scheduleTutorialOverlayRefresh(game, frames = 2) {
  const token = ++overlayRefreshToken;
  let remaining = frames;
  const tick = () => {
    if (token !== overlayRefreshToken) return;
    remaining -= 1;
    if (remaining <= 0) {
      renderTutorialOverlay(game);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function renderTutorialOverlay(game) {
  const overlay = document.getElementById('tutorial-overlay');
  const strip = document.getElementById('tutorial-strip');
  const modal = document.getElementById('tutorial-modal');
  const modalBody = document.getElementById('tutorial-modal-body');
  if (!strip) return;

  let ui = game.getTutorialUi();

  if (ui?.stepId !== lastTutorialStepId) {
    lastTutorialStepId = ui?.stepId || null;
    lastTutorialNavKey = null;
  }

  if (ui?.craftEquipPhase) {
    game.syncTutorialInventory();
    ui = game.getTutorialUi();
  }

  if (!ui) {
    strip.classList.add('hidden');
    hideTutorialSpotlight();
    hideTutorialModal();
    clearAllHints();
    unbindSpotlightScroll();
    document.body.classList.remove('tutorial-active');
    return;
  }

  if (document.getElementById('tutorial-modal')?.classList.contains('active')
    && !ui.isIntro && !ui.isNickname && !ui.isGraduate && !ui.isWeaponOffer && !ui.isWeaponGallery && !ui.isStarterAxe && !ui.isAxeOffer) {
    hideTutorialSpotlight();
    return;
  }

  if (ui.isNickname && modal && modalBody) {
    strip.classList.add('hidden');
    hideTutorialSpotlight();
    unbindSpotlightScroll();
    renderNicknameModal(game, modalBody);
    modal.classList.add('active');
    document.body.classList.add('tutorial-modal-open');
    return;
  }

  if (ui.isIntro && modal && modalBody) {
    strip.classList.add('hidden');
    hideTutorialSpotlight();
    unbindSpotlightScroll();
    renderIntroModal(game, modalBody);
    modal.classList.add('active');
    document.body.classList.add('tutorial-modal-open');
    return;
  }

  if (ui.isStarterAxe && modal && modalBody) {
    strip.classList.remove('hidden');
    overlay?.classList.add('hidden');
    clearAllHints();
    unbindSpotlightScroll();
    renderStarterAxeModal(game, modalBody);
    modal.classList.add('active');
    document.body.classList.add('tutorial-modal-open');
    document.body.classList.add('tutorial-active');
    strip.innerHTML = `
      <div class="tutorial-strip-inner">
        <div class="tutorial-strip-main">
          <span class="tutorial-strip-step">Étape ${ui.stepNumber}/${ui.stepTotal}</span>
          <strong class="tutorial-strip-title">Hache de formation</strong>
          <span class="tutorial-strip-text tutorial-strip-emphasis">👆 Touche « Équiper la hache » dans la fenêtre.</span>
        </div>
      </div>
    `;
    return;
  }

  if (ui.isAxeOffer && modal && modalBody) {
    strip.classList.remove('hidden');
    overlay?.classList.add('hidden');
    clearAllHints();
    unbindSpotlightScroll();
    renderAxeOfferModal(game, modalBody, ui);
    modal.classList.add('active');
    document.body.classList.add('tutorial-modal-open');
    document.body.classList.add('tutorial-active');
    strip.innerHTML = `
      <div class="tutorial-strip-inner">
        <div class="tutorial-strip-main">
          <span class="tutorial-strip-step">Étape ${ui.stepNumber}/${ui.stepTotal}</span>
          <strong class="tutorial-strip-title">Ta première hache</strong>
          <span class="tutorial-strip-text tutorial-strip-emphasis">👆 Touche « Recevoir ma hache » dans la fenêtre.</span>
        </div>
      </div>
    `;
    return;
  }

  if ((ui.isWeaponOffer || ui.isWeaponGallery) && modal && modalBody) {
    strip.classList.remove('hidden');
    overlay?.classList.add('hidden');
    clearAllHints();
    unbindSpotlightScroll();
    renderTutorialWeaponOffer(game, modalBody);
    modal.classList.add('active');
    document.body.classList.add('tutorial-modal-open');
    document.body.classList.add('tutorial-active');
    strip.innerHTML = `
      <div class="tutorial-strip-inner">
        <div class="tutorial-strip-main">
          <span class="tutorial-strip-step">Étape ${ui.stepNumber}/${ui.stepTotal}</span>
          <strong class="tutorial-strip-title">Arme de débutant</strong>
          <span class="tutorial-strip-text tutorial-strip-emphasis">👆 Touche « Accepter cette arme » dans la fenêtre.</span>
        </div>
      </div>
    `;
    return;
  }

  if (ui.isGraduate && modal && modalBody) {
    strip.classList.add('hidden');
    hideTutorialSpotlight();
    unbindSpotlightScroll();
    renderGraduateModal(game, modalBody);
    modal.classList.add('active');
    document.body.classList.add('tutorial-modal-open');
    return;
  }

  hideTutorialModal();
  document.body.classList.add('tutorial-active');

  if (!ui.screen && !ui.isWeaponOffer && !ui.isStarterAxe && !ui.isAxeOffer) {
    ensureTutorialNavigation(ui);
  }

  const currentView = getView();
  const micro = resolveMicroHint(ui, currentView, game);

  if (isBlockingGameModalOpen(ui)) {
    hideTutorialSpotlight();
    strip.classList.remove('hidden');
    const stepLabel = ui.stepTotal ? `Étape ${ui.stepNumber}/${ui.stepTotal}` : 'Formation';
    strip.innerHTML = `
      <div class="tutorial-strip-inner">
        <div class="tutorial-strip-main">
          <span class="tutorial-strip-step">${stepLabel}</span>
          <strong class="tutorial-strip-title">${micro.title}</strong>
          <span class="tutorial-strip-text tutorial-strip-emphasis">${micro.text}</span>
        </div>
      </div>
    `;
    return;
  }

  if (isTutorialDungeonCombatOpen(game)) {
    strip.classList.remove('hidden');
    overlay?.classList.add('hidden');
    if (spotlightTarget) {
      spotlightTarget.classList.remove('tutorial-highlight');
      spotlightTarget = null;
    }
    spotlightSelector = null;
    hintElements.forEach((el) => {
      if (!el.closest('#dungeon-combat-modal')) el.classList.remove(HINT_CLASS);
    });
    hintElements = hintElements.filter((el) => el.closest('#dungeon-combat-modal'));
    document.getElementById('tutorial-spotlight-hole')?.style.setProperty('display', 'none');
    unbindSpotlightScroll();
    const stepLabel = ui.stepTotal ? `Étape ${ui.stepNumber}/${ui.stepTotal}` : 'Formation';
    strip.innerHTML = `
      <div class="tutorial-strip-inner">
        <div class="tutorial-strip-main">
          <span class="tutorial-strip-step">${stepLabel}</span>
          <strong class="tutorial-strip-title">Combat de formation</strong>
          <span class="tutorial-strip-text tutorial-strip-emphasis">Suis les instructions dans la fenêtre de combat.</span>
        </div>
      </div>
    `;
    return;
  }

  strip.classList.remove('hidden');
  overlay?.classList.remove('hidden');

  if (!micro.selector && micro.finger === '✅') {
    scheduleTutorialOverlayRefresh(game, 2);
    strip.classList.remove('hidden');
    const stepLabel = ui.stepTotal ? `Étape ${ui.stepNumber}/${ui.stepTotal}` : 'Formation';
    strip.innerHTML = `
      <div class="tutorial-strip-inner">
        <div class="tutorial-strip-main">
          <span class="tutorial-strip-step">${stepLabel}</span>
          <strong class="tutorial-strip-title">${micro.title}</strong>
          <span class="tutorial-strip-text tutorial-strip-emphasis">${micro.text}</span>
        </div>
      </div>
    `;
    return;
  }

  if (micro.selector) {
    applyTutorialFocus(micro.selector);
  } else {
    clearAllHints();
    document.getElementById('tutorial-spotlight-hole')?.style.setProperty('display', 'none');
  }

  const fingerPrefix = micro.finger && micro.finger !== '✅' ? `${micro.finger} ` : '';
  const stepLabel = ui.stepTotal ? `Étape ${ui.stepNumber}/${ui.stepTotal}` : 'Formation';

  strip.innerHTML = `
    <div class="tutorial-strip-inner">
      <div class="tutorial-strip-main">
        <span class="tutorial-strip-step">${stepLabel}</span>
        <strong class="tutorial-strip-title">${micro.title}</strong>
        <span class="tutorial-strip-text tutorial-strip-emphasis">${fingerPrefix}${micro.text}</span>
      </div>
      <div class="tutorial-strip-actions">
        ${ui.showSkip ? '<button type="button" class="btn-tutorial btn-tutorial-compact" id="tutorial-skip">Passer la formation</button>' : ''}
      </div>
    </div>
  `;

  strip.querySelector('#tutorial-skip')?.addEventListener('click', () => {
    if (window.confirm('Passer la formation ? Tu pourras la revoir dans Options.')) {
      game.dismissTutorial();
      teardownTutorialOverlay();
    }
  });
}

export function teardownTutorialOverlay() {
  overlayRefreshToken += 1;
  lastTutorialNavKey = null;
  clearAllHints();
  unbindSpotlightScroll();
  hideTutorialModal();
  closeTutorialSidebar();
  document.getElementById('tutorial-overlay')?.classList.add('hidden');
  document.getElementById('tutorial-strip')?.classList.add('hidden');
  document.body.classList.remove('tutorial-active');
  document.body.classList.remove('tutorial-modal-open');
}

let sidebarTutorialBound = false;
let tutorialModalBound = false;

export function bindTutorialModalListeners(game) {
  if (tutorialModalBound) return;
  tutorialModalBound = true;

  document.getElementById('tutorial-modal')?.addEventListener('click', (e) => {
    if (!e.target.closest('#tutorial-accept-axe')) return;
    handleTutorialAxeAccept(game, e);
  });
}

export function bindTutorialSidebarListeners(game) {
  if (sidebarTutorialBound) return;
  sidebarTutorialBound = true;

  const refresh = () => {
    if (game.isTutorialActive()) {
      requestAnimationFrame(() => renderTutorialOverlay(game));
    }
  };

  document.getElementById('burger-btn')?.addEventListener('click', () => {
    setTimeout(refresh, 280);
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', refresh);
  document.getElementById('sidebar')?.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform') refresh();
  });
}
