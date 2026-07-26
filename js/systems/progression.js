/** Paliers ressources : déblocage métier et XP récolte sont séparés. */

const tierCache = new Map();

/**
 * Courbe XP par paliers (soft → hard).
 * `curve` : [{ untilLevel: 20, scaling: 1.06 }, …]
 * Pour le coût du niveau L → L+1 : base × produit des scalings pour les étapes 1…L-1.
 */
export function getScaledXpForLevel(xpPerLevel, level, curve, flatScaling = 1.12) {
  const base = Number(xpPerLevel) || 100;
  const lv = Math.max(1, Number(level) || 1);
  if (!Array.isArray(curve) || curve.length === 0) {
    return Math.floor(base * Math.pow(Number(flatScaling) || 1.12, lv - 1));
  }
  let mult = 1;
  for (let step = 1; step < lv; step++) {
    let scaling = curve[curve.length - 1].scaling;
    for (const seg of curve) {
      if (step < (seg.untilLevel ?? Infinity)) {
        scaling = seg.scaling;
        break;
      }
    }
    mult *= Number(scaling) || 1.12;
  }
  return Math.floor(base * mult);
}

function harvestableResourcesForJob(resources, jobId) {
  return Object.values(resources)
    .filter((r) =>
      r.job === jobId
      && !r.craftOnly
      && !r.combatOnly
      && !r.farmOnly
      && !r.notHarvestable
    )
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1) || a.id.localeCompare(b.id));
}

export function getResourceTierIndex(resource, resources) {
  if (!resource?.job) return 0;
  const key = `${resource.job}:${resource.id}`;
  if (tierCache.has(key)) return tierCache.get(key);
  const list = harvestableResourcesForJob(resources, resource.job);
  const idx = Math.max(0, list.findIndex((r) => r.id === resource.id));
  tierCache.set(key, idx);
  return idx;
}

/** Niveau métier requis pour récolter / débloquer la ressource (≠ XP récolte). */
export function getResourceUnlockJobLevel(resource, resources, balance) {
  const tier = getResourceTierIndex(resource, resources);
  if (tier <= 0) return balance?.resourceUnlock?.starterLevel ?? 1;
  const cfg = balance?.resourceUnlock || { baseLevel: 12, perTierStep: 6 };
  return cfg.baseLevel + (tier - 1) * cfg.perTierStep;
}

/** XP fixe par récolte — indépendant du coût pour monter de niveau. */
export function getHarvestXpForResource(resource, resources, balance) {
  const cfg = balance?.harvestXpByTier || { base: 10, step: 4 };
  const tier = getResourceTierIndex(resource, resources);
  if (cfg.useResourceData && resource?.xpPerHarvest != null) {
    return resource.xpPerHarvest;
  }
  return cfg.base + tier * cfg.step;
}

export function getRegrowthTier(resource, resources) {
  return getResourceTierIndex(resource, resources);
}

export function clearProgressionCache() {
  tierCache.clear();
}

/** @deprecated Utiliser getResourceUnlockJobLevel */
export function getEffectiveRequiredJobLevel(resource, resources, balance = null) {
  return getResourceUnlockJobLevel(resource, resources, balance || {});
}

/** @deprecated Utiliser getHarvestXpForResource */
export function getEffectiveHarvestXp(resource, resources, balance = null) {
  return getHarvestXpForResource(resource, resources, balance || {});
}

/** @deprecated Ancienne échelle 10/14/18 — ne plus utiliser pour les déblocages */
export function getLineUnlockLevel(tierIndex) {
  if (tierIndex <= 0) return 1;
  return 20 + (tierIndex - 1) * 20;
}
