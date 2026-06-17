/** Chemins vers `asset to-kirha/` — dossier laissé tel quel à la racine du projet. */
const ROOT = 'asset to-kirha';

function asset(...parts) {
  return encodeURI([ROOT, ...parts].join('/'));
}

const B = 'metiers/bucheron ';
const P = 'metiers/paysan';
const F = 'metiers/pecheur';
const V = 'icone page ville';
const D = 'divers icone';

export const UI = {
  kirha: asset(D, 'token_transparent.png'),
  scroll: asset(D, 'parchemin ancien transparent.png'),
  nugget: asset('pepites d_or', 'pepite_150_transparent.png'),
  vip: asset(D, 'vip_transparent.png'),
  settings: asset(D, 'parametre_transparent.png'),
  appIcon: asset('icone application ', 'icone application.jpg'),
  save: asset(V, 'sauvegarde_transparent.png'),
  ferme: asset(V, 'ferme_transparent.png'),
};

export const NAV_ICONS = {
  character: asset(V, 'maison_transparent.png'),
  world: asset(V, 'kirha_city_transparent.png'),
  missions: asset(D, 'parchemin ancien transparent.png'),
  job_lumberjack: asset(B, 'icone_bucheron_transparent.png'),
  job_fisher: asset('metiers/pecheur', 'icone_pecheur_transparent.png'),
  job_miner: asset('metiers/mineur', 'icone_mineur_transparent.png'),
  job_farmer: asset(P, 'icone_paysan_transparent.png'),
  job_alchemist: asset('metiers/alchimiste ', 'icone_alchimiste_transparent.png'),
  farm: asset(V, 'ferme_transparent.png'),
  inventory: asset(V, 'banque_transparent.png'),
  auction_house: asset(V, 'hdv_transparent.png'),
  workshop: asset(V, 'craft.jpg'),
  cuisine: asset(D, 'cuisine_transparent.png'),
  strategy: asset(D, 'vip_transparent.png'),
  combat: asset(V, 'temple_transparent.png'),
  options: asset(D, 'parametre_transparent.png'),
};

export const CATEGORY_ICONS = {
  recolte: asset(V, 'recolte_transparent.png'),
  ferme: asset(V, 'ferme_transparent.png'),
  gestion: asset(V, 'inventaire_transparent.png'),
  monde: asset(V, 'kirha_city_transparent.png'),
  personnage: asset(V, 'maison_transparent.png'),
  outillage: asset(V, 'ferme_transparent.png'),
  artisanat: asset(V, 'craft.jpg'),
  cuisine: asset(D, 'cuisine_transparent.png'),
};

export const JOB_ICONS = {
  lumberjack: NAV_ICONS.job_lumberjack,
  fisher: NAV_ICONS.job_fisher,
  miner: NAV_ICONS.job_miner,
  farmer: NAV_ICONS.job_farmer,
  alchemist: NAV_ICONS.job_alchemist,
  breeder: UI.ferme,
  cook: asset(D, 'cuisine_transparent.png'),
};

const FARM_BUILDING_FILES = {
  well: asset('eau', 'puit_transparent.png'),
  chicken_coop: asset('ferme', 'poulallier_transparent.png'),
  barn: asset('ferme', 'etable_transparent.png'),
  sheepfold: asset('ferme', 'bergerie_transparent.png'),
  pigsty: asset('ferme', 'porcherie_transparent.png'),
  beehive: asset('ferme', 'ruches_transparent.png'),
};

const FARM_PRODUCT_FILES = {
  eau: asset('eau', 'eau_inventaire_transparent.png'),
  oeuf: asset('ferme', 'oeuf_transparent.png'),
  lait: asset('ferme', 'lait_transparent.png'),
  laine: asset('ferme', 'laine_transparent.png'),
  bacon: asset('ferme', 'bacon_transparent.png'),
  miel: asset('ferme', 'miel_transparent.png'),
};

const FARMER_FILES = {
  ble: {
    available: 'champs_ble_transparent.png',
    regrowing: 'ble_coupe_transparent.png',
    inventory: 'ble_inventaire_transparent.png',
  },
  orge: {
    available: 'orge_transparent.png',
    regrowing: 'orge_coupe_transparent.png',
    inventory: 'orge_inventaire_transparent.png',
  },
  avoine: {
    available: 'avoine_transparent.png',
    regrowing: 'avoine_coupe_transparent.png',
    inventory: 'avoine_inventaire_transparent.png',
  },
  houblon: {
    available: 'seigle_transparent.png',
    regrowing: 'seigle_coupe_transparent.png',
    inventory: 'seigle_inventaire_transparent.png',
  },
};

const LUMBERJACK_FILES = {
  frene: {
    available: 'frene_transparent.png',
    regrowing: 'tronc_frene_transparent.png',
    inventory: 'frene_inventaire_transparent.png',
  },
  chataignier: {
    available: 'sequoia_transparent.png',
    regrowing: 'tronc_sequoia_transparent.png',
    inventory: 'ressource_sequoia_transparent.png',
  },
  noyer: {
    available: 'chene_transparent.png',
    regrowing: 'tronc_chene_transparent.png',
    inventory: 'chene_inventaire_transparent.png',
  },
  chene: {
    available: 'bouleau_transparent.png',
    regrowing: 'tronc_bouleau_transparent.png',
    inventory: 'bouleau_inventaire_transparent.png',
  },
  bombu: {
    available: 'erable_transparent.png',
    regrowing: 'tronc_erable_transparent.png',
    inventory: 'erable_inventaire_transparent.png',
  },
  erable: {
    available: 'bambou_transparent.png',
    regrowing: 'tronc_bambou_transparent.png',
    inventory: 'bambou_inventaire_transparent.png',
  },
  if: {
    available: 'ginkgo_transparent.png',
    regrowing: 'tronc_ginkgo_transparent.png',
    inventory: 'ginkgo_inventaire_transparent.png',
  },
  bambou: {
    available: 'magnolia_transparent.png',
    regrowing: 'tronc_magnolia_transparent.png',
    inventory: 'magnolia_inventaire_transparent.png',
  },
  merisier: {
    available: 'cerisier_dore_transparent.png',
    regrowing: 'tronc_cerisier_dore_transparent.png',
    inventory: 'cerisier_dore_inventaire_transparent.png',
  },
  charme: {
    available: 'sakura_transparent.png',
    regrowing: 'tronc_sakura_transparent.png',
    inventory: 'sakura_inventaire_transparent.png',
  },
  orme: {
    available: 'sakura_transparent.png',
    regrowing: 'tronc_sakura_transparent.png',
    inventory: 'sakura_inventaire_transparent.png',
  },
};

/** Slot récolte pêcheur : même visuel pour toutes les espèces ; inventaire par ressource si dispo */
const FISHER_SLOT_SPRITES = {
  available: asset(F, 'pecheur_avec_poisson_transparent.png'),
  regrowing: asset(F, 'pecheur_sans_poisson_transparent.png'),
};

const FISHER_INVENTORY_FILES = {
  dorade: 'dorade_transparent.png',
};

function getFisherSprites(resourceId) {
  const invFile = FISHER_INVENTORY_FILES[resourceId];
  return {
    available: FISHER_SLOT_SPRITES.available,
    regrowing: FISHER_SLOT_SPRITES.regrowing,
    inventory: invFile ? asset(F, invFile) : null,
  };
}

function farmerSprite(id, kind) {
  const file = FARMER_FILES[id]?.[kind];
  return file ? asset(P, file) : null;
}

function lumberjackSprite(id, kind) {
  const file = LUMBERJACK_FILES[id]?.[kind];
  return file ? asset(B, file) : null;
}

export function getResourceSprites(resourceId) {
  if (FARMER_FILES[resourceId]) {
    return {
      available: farmerSprite(resourceId, 'available'),
      regrowing: farmerSprite(resourceId, 'regrowing'),
      inventory: farmerSprite(resourceId, 'inventory'),
    };
  }
  if (LUMBERJACK_FILES[resourceId]) {
    return {
      available: lumberjackSprite(resourceId, 'available'),
      regrowing: lumberjackSprite(resourceId, 'regrowing'),
      inventory: lumberjackSprite(resourceId, 'inventory'),
    };
  }
  return null;
}

export function getJobIcon(jobId) {
  return JOB_ICONS[jobId] || null;
}

export function getFarmBuildingIcon(buildingId) {
  return FARM_BUILDING_FILES[buildingId] || UI.ferme;
}

export function getFarmProductIcon(productId) {
  return FARM_PRODUCT_FILES[productId] || null;
}

export function getNavIcon(viewId) {
  if (viewId?.startsWith('farm_')) {
    return getFarmBuildingIcon(viewId.slice(5));
  }
  return NAV_ICONS[viewId] || null;
}

export function getCategoryIcon(catId) {
  return CATEGORY_ICONS[catId] || null;
}

export function getResourceIcon(resource) {
  if (!resource) return null;
  return resource.visual?.sprite?.inventory || resource.sprite || resource.icon || null;
}

export function hasResourceIcon(resource) {
  return !!getResourceIcon(resource);
}

export function iconHtml(src, className = 'ui-icon', alt = '') {
  if (!src) return '';
  const safeAlt = alt.replace(/"/g, '&quot;');
  return `<img class="${className}" src="${src}" alt="${safeAlt}" loading="lazy" decoding="async" />`;
}

export function renderResourceIcon(resource, className = 'resource-icon-img') {
  const src = getResourceIcon(resource);
  if (src) return iconHtml(src, className, resource?.name || '');
  if (resource?.emoji) {
    return `<span class="resource-icon-emoji" aria-hidden="true">${resource.emoji}</span>`;
  }
  return '';
}

export function labelWithIcon(resource, className = 'resource-icon-img') {
  if (!resource) return '';
  const icon = renderResourceIcon(resource, className);
  return `${icon}<span class="label-text">${resource.name}</span>`;
}

export function applyAssetPaths(resources) {
  for (const [id, res] of Object.entries(resources)) {
    const sprites = getResourceSprites(id) || (res.job === 'fisher' ? getFisherSprites(id) : null);
    if (sprites) {
      if (!res.visual) res.visual = {};
      res.visual.sprite = sprites;
      if (!res.visual.harvesting) {
        res.visual.harvesting = { label: 'Récolte…' };
      }
    }
  }

  if (resources.ancient_scroll) {
    resources.ancient_scroll.sprite = UI.scroll;
  }

  if (resources.gold_nugget) {
    resources.gold_nugget.sprite = asset('pepites d_or', 'pepite_150_transparent.png');
  }
}

export function applyJobIcons(jobs) {
  for (const [id, job] of Object.entries(jobs)) {
    const icon = getJobIcon(id);
    if (icon) job.icon = icon;
  }
}
