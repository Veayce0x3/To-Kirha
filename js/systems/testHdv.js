/**
 * HDV test (beta) — vente des ressources métiers/ferme pour faciliter les tests.
 * Remplacé plus tard par l'HDV joueur ↔ joueur.
 */

import {
  GATHERING_JOB_IDS,
  isGatheringJobUnlocked,
  isFarmBuildingUnlocked,
} from './careerChoice.js';

const FREE_FARM_BUILDING = 'well';
import { FARM_BUILDING_LABELS } from './farm.js';
import { isMaintenanceMode, isTestHdvLiveEnabled } from './gameConfig.js';

const EXCLUDED_ID_PREFIXES = ['meal_', 'key_'];
const EXCLUDED_IDS = new Set(['ancient_scroll', 'gold_nugget', 'kirha']);

function isTestHdvCfg(balance) {
  return !!balance?.testHdv?.enabled;
}

export function isTestHdvEnabled(balance) {
  if (isMaintenanceMode() || !isTestHdvLiveEnabled()) return false;
  return isTestHdvCfg(balance);
}

function calcUnitPrice(resource, balance) {
  const cfg = balance.testHdv || {};
  if (cfg.flatUnitPrice != null) return Math.max(1, Math.floor(cfg.flatUnitPrice));
  const mult = cfg.priceMultiplier ?? 1.2;
  const maxPrice = cfg.flatMaxPrice ?? 12;
  const base = resource.sellPrice || 3;
  return Math.max(1, Math.min(maxPrice, Math.ceil(base * mult)));
}

function isExcludedResource(id, resource) {
  if (!resource || EXCLUDED_IDS.has(id)) return true;
  if (EXCLUDED_ID_PREFIXES.some((p) => id.startsWith(p))) return true;
  if (resource.combatOnly || resource.merchantOnly || resource.notSellable) return true;
  if (resource.craftOnly && !resource.farmOnly) return true;
  if (id.startsWith('meal_')) return true;
  return false;
}

function isHarvestOffer(resource) {
  return (
    resource.job
    && GATHERING_JOB_IDS.includes(resource.job)
    && !resource.craftOnly
    && !resource.combatOnly
    && !resource.farmOnly
    && !resource.notHarvestable
  );
}

function isFarmOffer(resource) {
  return resource.farmOnly && resource.job === 'breeder';
}

function makeOffer(resourceId, resource, balance) {
  const cfg = balance.testHdv || {};
  return {
    resourceId,
    unitPrice: calcUnitPrice(resource, balance),
    sellable: false,
    testHdv: true,
    bulkQuantities: cfg.bulkQuantities || [1, 5, 10, 25],
  };
}

/**
 * Vendeurs dynamiques : métiers / bâtiments de carrière.
 */
export function buildTestHdvVendors(state, resources, farmData, balance, jobs) {
  if (!isTestHdvCfg(balance) || !state.careerChoice?.confirmed) {
    return {};
  }

  const vendors = {};

  for (const jobId of GATHERING_JOB_IDS) {
    const job = jobs[jobId];
    const chosen = isGatheringJobUnlocked(jobId, state, balance);
    const offers = {};
    for (const [id, resource] of Object.entries(resources)) {
      if (isExcludedResource(id, resource)) continue;
      if (!isHarvestOffer(resource) || resource.job !== jobId) continue;
      offers[id] = makeOffer(id, resource, balance);
    }
    if (!Object.keys(offers).length) continue;

    vendors[`test_hdv_job_${jobId}`] = {
      id: `test_hdv_job_${jobId}`,
      name: job?.name || jobId,
      emoji: job?.emoji || '📦',
      description: chosen
        ? `Ressources ${job?.name || jobId} — ton métier, disponible aussi à l'achat pour les tests.`
        : `Ressources ${job?.name || jobId} — complément de carrière.`,
      testHdv: true,
      offers,
    };
  }

  for (const [buildingId, building] of Object.entries(farmData?.buildings || {})) {
    if (buildingId === FREE_FARM_BUILDING) continue;
    const chosen = isFarmBuildingUnlocked(buildingId, state, balance);

    const offers = {};
    for (const productId of Object.keys(building.products || {})) {
      const resource = resources[productId];
      if (isExcludedResource(productId, resource)) continue;
      if (!isFarmOffer(resource)) continue;
      offers[productId] = makeOffer(productId, resource, balance);
    }
    if (!Object.keys(offers).length) continue;

    const label = FARM_BUILDING_LABELS[buildingId] || building.name || buildingId;
    vendors[`test_hdv_farm_${buildingId}`] = {
      id: `test_hdv_farm_${buildingId}`,
      name: label,
      emoji: building.emoji || '🏠',
      description: chosen
        ? `Produits ${label} — ton bâtiment, disponible aussi à l'achat pour les tests.`
        : `Produits ${label} — complément de carrière.`,
      testHdv: true,
      offers,
    };
  }

  return vendors;
}

export function mergeMerchantVendors(merchant, testVendors) {
  return { ...(merchant?.vendors || {}), ...testVendors };
}

export function getTestHdvBanner(balance) {
  if (!isTestHdvCfg(balance)) return null;
  return balance.testHdv.banner
    || 'Marché test — achète ici les ressources métiers et ferme pour faciliter les tests. HDV joueur à venir.';
}
