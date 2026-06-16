import { isQuestCompleted } from './quests.js';
import {
  ensureTutorialFlags,
  getChosenTutorialRecipeId,
  reconcileTutorialWeaponProgress,
  normalizeRewardsClaimed,
  hasTutorialRewardsClaimed,
} from './tutorialSandbox.js';

export {
  normalizeRewardsClaimed,
  hasTutorialRewardsClaimed,
  canClaimTutorialReward,
  claimTutorialReward,
} from './tutorialSandbox.js';

export function buildDefaultTutorialState() {
  return {
    stepIndex: 0,
    completed: false,
    dismissed: false,
    sandbox: false,
    replay: false,
    chosenWeaponType: null,
    chosenRecipeId: null,
    trainingFightWon: false,
    flags: {
      harvestDone: false,
      weaponChosen: false,
      weaponCrafted: false,
      weaponEquipped: false,
      dungeonWon: false,
      scrollBought: false,
    },
    rewardsClaimed: {
      materials: false,
      harvestKirha: false,
      scrollPrep: false,
      graduateKirha: false,
      dungeonDrops: false,
    },
  };
}

export function migrateTutorial(saved) {
  if (!saved) return buildDefaultTutorialState();
  const base = buildDefaultTutorialState();
  let rewardsClaimed = normalizeRewardsClaimed(saved.rewardsClaimed);
  if ((saved.completed || saved.dismissed) && !Object.values(rewardsClaimed).some(Boolean)) {
    rewardsClaimed = normalizeRewardsClaimed(true);
  }
  return {
    ...base,
    stepIndex: saved.stepIndex || 0,
    completed: !!saved.completed,
    dismissed: !!saved.dismissed,
    sandbox: !!saved.sandbox,
    replay: !!saved.replay,
    chosenWeaponType: saved.chosenWeaponType || null,
    chosenRecipeId: saved.chosenRecipeId || null,
    trainingFightWon: !!saved.trainingFightWon,
    flags: { ...base.flags, ...(saved.flags || {}) },
    rewardsClaimed,
  };
}

export function isTutorialActive(state) {
  const t = state.tutorial;
  return t && !t.completed && !t.dismissed;
}

export function shouldShowTutorialIntro(state) {
  const t = state.tutorial;
  if (!t || t.completed || t.dismissed) return false;
  if (t.replay) return true;
  const onIntro = (t.stepIndex || 0) === 0 && !t.sandbox;
  return onIntro;
}

export function getTutorialStep(state, tutorialData) {
  if (!isTutorialActive(state)) return null;
  const steps = tutorialData?.steps || [];
  const idx = Math.min(state.tutorial.stepIndex || 0, steps.length - 1);
  return steps[idx] || null;
}

export function getTutorialStepIndex(tutorialData, stepId) {
  return (tutorialData?.steps || []).findIndex((s) => s.id === stepId);
}

function isFlagComplete(step, state) {
  ensureTutorialFlags(state);
  const flags = state.tutorial.flags;
  switch (step.completeWhen) {
    case 'tutorial_harvest_done':
      return !!flags.harvestDone;
    case 'tutorial_weapon_chosen':
      return !!flags.weaponChosen;
    case 'tutorial_weapon_equipped':
      return !!flags.weaponEquipped;
    case 'tutorial_dungeon_won':
      return !!flags.dungeonWon;
    case 'tutorial_scroll_bought':
      return !!flags.scrollBought;
    case 'tutorial_fight_won':
      return !!state.tutorial.trainingFightWon;
    default:
      return false;
  }
}

export function syncTutorialProgress(state, tutorialData, quests, extras = {}) {
  if (!isTutorialActive(state)) return false;

  if (extras.recipes && extras.combatItems) {
    reconcileTutorialWeaponProgress(state, extras.recipes, extras.combatItems);
  }

  const steps = tutorialData?.steps || [];
  let changed = false;

  while (state.tutorial.stepIndex < steps.length) {
    const step = steps[state.tutorial.stepIndex];
    if (!step) break;

    if (step.complete) {
      state.tutorial.completed = true;
      state.tutorial.sandbox = false;
      state.tutorial.replay = false;
      changed = true;
      break;
    }

    if (step.completeWhen && isFlagComplete(step, state)) {
      state.tutorial.stepIndex += 1;
      changed = true;
      continue;
    }

    if (step.questId && isQuestCompleted(state, step.questId)) {
      state.tutorial.stepIndex += 1;
      changed = true;
      continue;
    }

    break;
  }

  if (state.tutorial.stepIndex >= steps.length) {
    state.tutorial.completed = true;
    state.tutorial.sandbox = false;
    changed = true;
  }

  return changed;
}

export function advanceTutorialManual(state, tutorialData) {
  if (!isTutorialActive(state)) return false;
  const steps = tutorialData?.steps || [];
  const step = steps[state.tutorial.stepIndex];
  if (!step || step.questId || step.completeWhen || step.screen) return false;

  state.tutorial.stepIndex = Math.min(state.tutorial.stepIndex + 1, steps.length);
  if (state.tutorial.stepIndex >= steps.length) {
    state.tutorial.completed = true;
    state.tutorial.sandbox = false;
  }
  return true;
}

export function dismissTutorial(state) {
  if (!state.tutorial) state.tutorial = buildDefaultTutorialState();
  state.tutorial.dismissed = true;
  state.tutorial.completed = true;
  state.tutorial.sandbox = false;
  state.tutorial.replay = false;
}

export function resetTutorial(state) {
  const rewardsClaimed = normalizeRewardsClaimed(state.tutorial?.rewardsClaimed);
  state.tutorial = buildDefaultTutorialState();
  state.tutorial.replay = true;
  state.tutorial.rewardsClaimed = rewardsClaimed;
}

export function beginTutorialSandbox(state, tutorialData) {
  if (!state.tutorial) state.tutorial = buildDefaultTutorialState();
  const replay = hasTutorialRewardsClaimed(state) || !!state.tutorial.replay;
  state.tutorial.sandbox = true;
  state.tutorial.replay = replay;
  state.tutorial.dismissed = false;
  state.tutorial.completed = false;
  const harvestIdx = getTutorialStepIndex(tutorialData, 'harvest');
  if (harvestIdx >= 0) state.tutorial.stepIndex = harvestIdx;
}

export function getTutorialCraftPhase(state) {
  if (!isTutorialActive(state)) return null;
  ensureTutorialFlags(state);
  if (state.tutorial.flags.weaponEquipped) return null;
  if (!getChosenTutorialRecipeId(state)) return null;
  if (state.tutorial.flags.weaponCrafted) return 'equip';
  return 'craft';
}

export function getTutorialUi(state, tutorialData, quests, extras = {}) {
  syncTutorialProgress(state, tutorialData, quests, extras);
  if (!isTutorialActive(state)) return null;

  const steps = tutorialData?.steps || [];
  const step = getTutorialStep(state, tutorialData);
  if (!step) return null;

  const view = step.view || step.hintView || null;
  const hintJob = step.hintJob || extras.craftJobHint || null;
  const canManualNext = !step.questId && !step.complete && !step.completeWhen && !step.screen;
  const craftPhase = step.id === 'craft' ? getTutorialCraftPhase(state) : null;

  let title = step.title;
  let text = step.text;

  if (craftPhase === 'equip') {
    title = 'Équipe ton arme';
    text = 'Va sur Perso, section Équipement, et équipe l\'arme que tu viens de forger.';
  }

  return {
    stepId: step.id,
    title,
    text,
    highlight: step.highlight || null,
    navPulse: view,
    hintView: view,
    hintJob,
    targetView: view === 'workshop' && hintJob ? null : view,
    targetCraftJob: view === 'workshop' ? hintJob : null,
    craftPhase,
    screen: step.screen || null,
    showNext: canManualNext,
    showSkip: step.id !== 'graduate',
    showGo: false,
    isFinal: !!step.complete,
    isIntro: step.screen === 'intro',
    isGraduate: step.screen === 'graduate',
    isWeaponGallery: step.screen === 'weapon_gallery' || step.screen === 'weapon_offer',
    isWeaponOffer: step.screen === 'weapon_offer',
    isDungeonStep: step.id === 'dungeon',
    craftEquipPhase: craftPhase === 'equip',
    stepNumber: (state.tutorial.stepIndex || 0) + 1,
    stepTotal: steps.length,
    sandbox: !!state.tutorial.sandbox,
  };
}
