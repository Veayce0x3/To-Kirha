import { getResourceIcon, iconHtml } from '../core/assets.js';

/** Fallbacks par métier quand aucun sprite n'est disponible */
const JOB_FALLBACKS = {
  lumberjack: {
    available: { emoji: '🌳', label: 'Prêt à récolter' },
    harvesting: { emoji: '🪓', label: 'Récolte…' },
    regrowing: { emoji: '🪵', label: 'Repousse…' },
  },
  farmer: {
    available: { emoji: '🌾', label: 'Prêt à récolter' },
    harvesting: { emoji: '🌾', label: 'Récolte…' },
    regrowing: { emoji: '🌿', label: 'Repousse…' },
  },
  alchemist: {
    available: { emoji: '🌿', label: 'Prêt à récolter' },
    harvesting: { emoji: '🌿', label: 'Récolte…' },
    regrowing: { emoji: '🍂', label: 'Repousse…' },
  },
  miner: {
    available: { emoji: '🪨', label: 'Prêt à récolter' },
    harvesting: { emoji: '⛏️', label: 'Récolte…' },
    regrowing: { emoji: '⛰️', label: 'Repousse…' },
  },
  fisher: {
    available: { emoji: '🎣', label: 'Prêt à récolter' },
    harvesting: { emoji: '🎣', label: 'Récolte…' },
    regrowing: { emoji: '💧', label: 'Repousse…' },
  },
};

export function getSlotVisualState(slot) {
  if (!slot?.resourceId) return 'empty';
  if (slot.active?.phase === 'regrowing') return 'regrowing';
  if (slot.active) return 'harvesting';
  return 'available';
}

const NAV_HARVEST_PRIORITY = {
  ready: 4,
  harvesting: 3,
  regrowing: 2,
  empty: 1,
};

/** Indicateur menu latéral : ready | harvesting | regrowing | empty */
export function getJobHarvestNavStatus(state, jobId) {
  const slots = state.harvestSlots?.[jobId] || [];
  if (slots.length === 0) return 'empty';

  let best = 'empty';
  let bestPriority = 0;

  for (const slot of slots) {
    const visual = getSlotVisualState(slot);
    const status = visual === 'available' ? 'ready' : visual;
    const priority = NAV_HARVEST_PRIORITY[status] || 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      best = status;
    }
  }

  return best;
}

function getSpriteForState(resource, state) {
  const spriteKey = state === 'harvesting' ? 'available' : state;
  return resource?.visual?.sprite?.[spriteKey] || resource?.visual?.sprite?.[state] || null;
}

export function getResourceVisual(resource, visualState) {
  const state = visualState === 'regrowing' ? 'regrowing' : visualState === 'harvesting' ? 'harvesting' : 'available';
  const sprite = getSpriteForState(resource, state);
  const custom = resource?.visual?.[state] || resource?.visual?.[state === 'harvesting' ? 'available' : state];
  const label = state === 'harvesting'
    ? (resource?.visual?.harvesting?.label || 'Récolte…')
    : (custom?.label || JOB_FALLBACKS[resource?.job]?.[state]?.label || (state === 'regrowing' ? 'Repousse…' : 'Prêt à récolter'));

  if (sprite) {
    return { label, state, sprite, emoji: null };
  }

  const fallback = JOB_FALLBACKS[resource?.job]?.[state];
  if (custom?.emoji || fallback) {
    return {
      emoji: custom?.emoji || fallback?.emoji,
      label,
      state,
      sprite: null,
    };
  }

  return {
    emoji: resource?.emoji || '❓',
    label,
    state,
    sprite: null,
  };
}

export { getResourceIcon, iconHtml, renderResourceIcon } from '../core/assets.js';

export function getSlotVisualDisplay(resource, slot, progress = 0) {
  const visualState = getSlotVisualState(slot);

  if (visualState === 'empty') {
    return {
      visualState: 'empty',
      emoji: '⬜',
      label: 'Choisir une ressource',
      progress: 0,
      sprite: null,
      phase: null,
    };
  }

  const vis = getResourceVisual(resource, visualState);
  let label;

  if (visualState === 'regrowing' || visualState === 'harvesting') {
    label = resource.name;
  } else {
    label = `${resource.name} · ${vis.label}`;
  }

  return {
    visualState,
    emoji: vis.emoji,
    label,
    progress,
    sprite: vis.sprite,
    phase: slot.active?.phase || null,
  };
}
