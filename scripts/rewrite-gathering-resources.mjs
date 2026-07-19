/**
 * Réécrit les 5 métiers de récolte : 10 ressources, paliers 1→200.
 * Corrige les coquilles évidentes : ble, diamant, cristal_dore, wisteria, lotus doré lvl 200.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, data) => fs.writeFileSync(path.join(root, p), `${JSON.stringify(data, null, 2)}\n`);

/** Ancien id → nouvel id (migration inventaire / recettes) */
export const OLD_TO_NEW = {
  // Bûcheron
  frene: 'frene',
  chataignier: 'sequoia',
  noyer: 'chene',
  brume_saule: 'chene',
  chene: 'bouleau',
  if: 'ginkgo',
  bombu: 'erable',
  bambou: 'magnolia',
  erable: 'bambou',
  merisier: 'sakura_dore',
  charme: 'sakura',
  lotus_tree: 'sakura',
  orme: 'sakura_dore',
  // Pêcheur
  goujon: 'dorade',
  greuvette: 'crabe',
  truite: 'saumon',
  brume_truite: 'saumon',
  sardine: 'calmar',
  brochet: 'homard',
  carpe: 'naso',
  bar: 'naso',
  dorade: 'fugu',
  raie: 'pieuvre',
  perche: 'koi_dore',
  lotus_carp: 'carpe_koi',
  kralamoure: 'koi_dore',
  // Mineur
  fer: 'pierre',
  cuivre: 'fer',
  bronze: 'cuivre',
  brume_quartz: 'topaze',
  kobalte: 'fer',
  silicate: 'jade',
  manganese: 'topaze',
  argent: 'diamant',
  etain: 'emeraude',
  bauxite: 'saphir',
  or_minerai: 'cristal',
  lotus_crystal: 'cristal',
  cendrepierre: 'cristal_dore',
  // Alchimiste
  ortie: 'pissenlit',
  sauge: 'menthe',
  trefle: 'ortie',
  brume_lotus_herb: 'menthe',
  menthe: 'lavande',
  ginseng: 'chrysantheme',
  orchidee: 'pivoine',
  belladone: 'ginseng',
  edelweiss: 'wisteria',
  mandragore: 'lotus_sacre',
  perce_neige: 'lotus_sacre',
  lotus_essence: 'lotus_sacre',
  salikronia: 'lotus_sacre_dore',
  // Paysan
  ble: 'ble',
  orge: 'orge',
  avoine: 'seigle',
  brume_ble: 'orge',
  houblon: 'avoine',
  malt: 'seigle',
  lin: 'mais',
  chanvre: 'sarrasin',
  seigle: 'riz_sakura',
  mais: 'riz_sakura',
  millet: 'riz_sakura',
  lotus_grain: 'riz_sakura',
  frostiz: 'riz_dore',
};

const TIERS = [
  { level: 1, sell: 4, xp: 8, yield: 1, rarity: 'common', zone: 'village_sakura' },
  { level: 20, sell: 7, xp: 12, yield: 1, rarity: 'common', zone: 'village_sakura' },
  { level: 40, sell: 10, xp: 16, yield: 1, rarity: 'uncommon', zone: 'petal_forest' },
  { level: 60, sell: 13, xp: 20, yield: 2, rarity: 'uncommon', zone: 'petal_forest' },
  { level: 80, sell: 16, xp: 24, yield: 2, rarity: 'uncommon', zone: 'mist_river' },
  { level: 100, sell: 19, xp: 28, yield: 2, rarity: 'rare', zone: 'mist_river' },
  { level: 120, sell: 22, xp: 32, yield: 2, rarity: 'rare', zone: 'jade_mountains' },
  { level: 140, sell: 25, xp: 36, yield: 3, rarity: 'rare', zone: 'jade_mountains' },
  { level: 170, sell: 28, xp: 40, yield: 3, rarity: 'rare', zone: 'lotus_sanctuary' },
  { level: 200, sell: 34, xp: 48, yield: 4, rarity: 'rare', zone: 'lotus_sanctuary' },
];

const JOBS = {
  lumberjack: [
    ['frene', 'Frêne', '🌳'],
    ['sequoia', 'Séquoia', '🌲'],
    ['chene', 'Chêne', '🍂'],
    ['bouleau', 'Bouleau', '🌿'],
    ['ginkgo', 'Ginkgo', '🌿'],
    ['erable', 'Érable', '🍁'],
    ['magnolia', 'Magnolia', '🌸'],
    ['bambou', 'Bambou', '🎋'],
    ['sakura', 'Sakura', '🌸'],
    ['sakura_dore', 'Sakura Doré', '✨'],
  ],
  fisher: [
    ['dorade', 'Dorade', '🐟'],
    ['crabe', 'Crabe', '🦀'],
    ['saumon', 'Saumon', '🐟'],
    ['calmar', 'Calmar', '🦑'],
    ['homard', 'Homard', '🦞'],
    ['naso', 'Naso', '🐠'],
    ['fugu', 'Fugu', '🐡'],
    ['pieuvre', 'Pieuvre', '🐙'],
    ['carpe_koi', 'Carpe Koï', '🎏'],
    ['koi_dore', 'Carpe Koï dorée', '🐉'],
  ],
  miner: [
    ['pierre', 'Pierre', '🪨'],
    ['fer', 'Fer', '⚙️'],
    ['cuivre', 'Cuivre', '🟤'],
    ['topaze', 'Topaze', '💛'],
    ['jade', 'Jade', '🟢'],
    ['saphir', 'Saphir', '💠'],
    ['emeraude', 'Émeraude', '💚'],
    ['diamant', 'Diamant', '💎'],
    ['cristal', 'Cristal', '🔮'],
    ['cristal_dore', 'Cristal Doré', '✨'],
  ],
  alchemist: [
    ['pissenlit', 'Pissenlit', '🌼'],
    ['ortie', 'Ortie', '🌿'],
    ['menthe', 'Menthe', '🌿'],
    ['chrysantheme', 'Chrysanthème', '🌸'],
    ['lavande', 'Lavande', '💜'],
    ['ginseng', 'Ginseng', '🌿'],
    ['pivoine', 'Pivoine', '🌺'],
    ['wisteria', 'Wisteria', '🪻'],
    ['lotus_sacre', 'Lotus Sacré', '🪷'],
    ['lotus_sacre_dore', 'Lotus Sacré Doré', '✨'],
  ],
  farmer: [
    ['ble', 'Blé', '🌾'],
    ['orge', 'Orge', '🌾'],
    ['avoine', 'Avoine', '🌾'],
    ['seigle', 'Seigle', '🌾'],
    ['sarrasin', 'Sarrasin', '🥠'],
    ['houblon', 'Houblon', '🌾'],
    ['lin', 'Lin', '🌿'],
    ['mais', 'Maïs', '🌽'],
    ['riz_sakura', 'Riz Sakura', '🌸'],
    ['riz_dore', 'Riz Doré', '✨'],
  ],
};

function buildResource(job, id, name, emoji, tier) {
  return {
    id,
    name,
    emoji,
    zone: tier.zone,
    job,
    requiredJobLevel: tier.level,
    baseHarvestTime: 3000,
    baseYield: tier.yield,
    sellPrice: tier.sell,
    xpPerHarvest: tier.xp,
    rarity: tier.rarity,
    visual: {
      available: { emoji, label: 'Prêt à récolter' },
      regrowing: { emoji: '🌿', label: 'Repousse…' },
      harvesting: { emoji, label: 'Récolte…' },
    },
  };
}

function remapDeep(value, map, { remapObjectKeys = false } = {}) {
  if (Array.isArray(value)) {
    return value.map((v) => remapDeep(v, map, { remapObjectKeys }));
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && map[value]) return map[value];
    return value;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const nk = remapObjectKeys && map[k] ? map[k] : k;
    const nv = remapDeep(v, map, { remapObjectKeys });
    if (typeof nv === 'number' && typeof out[nk] === 'number') out[nk] += nv;
    else if (out[nk] !== undefined && typeof out[nk] === 'object' && typeof nv === 'object' && !Array.isArray(nv)) {
      out[nk] = { ...out[nk], ...nv };
    } else out[nk] = nv;
  }
  return out;
}

function remapIngredientBag(obj, map) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const nk = map[k] || k;
    out[nk] = (out[nk] || 0) + v;
  }
  return out;
}

// ── resources.json ──
const oldResources = read('data/resources.json');
const GATHER = new Set(['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist']);
const kept = {};
for (const [id, r] of Object.entries(oldResources)) {
  if (!GATHER.has(r.job)) kept[id] = r;
}

const newGather = {};
const idsByJob = {};
for (const [job, list] of Object.entries(JOBS)) {
  idsByJob[job] = list.map(([id]) => id);
  list.forEach(([id, name, emoji], i) => {
    newGather[id] = buildResource(job, id, name, emoji, TIERS[i]);
  });
}

const resourcesOut = { ...newGather, ...kept };
write('data/resources.json', resourcesOut);

function hasStaleGatheringId(data) {
  // Uniquement les anciens ids qui n'existent plus dans la nouvelle liste
  const newIds = new Set(Object.values(OLD_TO_NEW));
  const deleted = new Set(Object.keys(OLD_TO_NEW).filter((k) => !newIds.has(k)));
  const stack = [data];
  while (stack.length) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur)) {
        if (deleted.has(k) || (typeof v === 'string' && deleted.has(v))) return true;
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
  return false;
}

// ── recipes.json ──
const recipes = read('data/recipes.json');
if (hasStaleGatheringId(recipes)) {
  for (const recipe of Object.values(recipes)) {
    if (recipe.ingredients) {
      recipe.ingredients = remapIngredientBag(recipe.ingredients, OLD_TO_NEW);
    }
  }
  write('data/recipes.json', recipes);
} else {
  console.log('recipes déjà migrées — skip');
}

// ── farm.json ──
const farm = read('data/farm.json');
if (hasStaleGatheringId(farm)) {
  write('data/farm.json', remapDeep(farm, OLD_TO_NEW, { remapObjectKeys: true }));
} else {
  console.log('farm déjà migré — skip');
}

// ── aides.json ──
const aides = read('data/aides.json');
if (hasStaleGatheringId(aides)) {
  write('data/aides.json', remapDeep(aides, OLD_TO_NEW, { remapObjectKeys: false }));
} else {
  console.log('aides déjà migrés — skip');
}

// ── quests.json ──
const quests = read('data/quests.json');
if (hasStaleGatheringId(quests)) {
  write('data/quests.json', remapDeep(quests, OLD_TO_NEW, { remapObjectKeys: false }));
} else {
  console.log('quests déjà migrées — skip');
}

// ── balance.json ──
const balance = read('data/balance.json');
balance.saveVersion = 33;
balance.appBuildId = '20260719-1400';

balance.harvestSlots.unlockResourceByJob = {
  lumberjack: 'frene',
  farmer: 'ble',
  miner: 'pierre',
  fisher: 'dorade',
  alchemist: 'pissenlit',
};

// Coûts slots 2..9 → ressources index 0,2,3,5,6,7,8,9
const unlockPick = [null, null, 0, 2, 3, 5, 6, 7, 8, 9];
balance.harvestSlots.unlockResourcesByJob = {};
for (const [job, ids] of Object.entries(idsByJob)) {
  balance.harvestSlots.unlockResourcesByJob[job] = unlockPick.map((idx) => (
    idx == null ? null : { [ids[idx]]: 10 }
  ));
}

if (balance.zones) {
  balance.zones = remapDeep(balance.zones, OLD_TO_NEW, { remapObjectKeys: true });
}
write('data/balance.json', balance);

console.log('OK — 50 ressources récolte écrites.');
console.log('IDs par métier:', idsByJob);
