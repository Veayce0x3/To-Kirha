/**
 * Herbier — collection des ressources découvertes (récolte & ferme).
 */

const JOB_GROUP_ORDER = ['farmer', 'lumberjack', 'fisher', 'miner', 'alchemist', 'farm'];

const JOB_GROUP_META = {
  farmer: { id: 'farmer', label: 'Agriculture', emoji: '🌾' },
  lumberjack: { id: 'lumberjack', label: 'Bois', emoji: '🪓' },
  fisher: { id: 'fisher', label: 'Pêche', emoji: '🎣' },
  miner: { id: 'miner', label: 'Mine', emoji: '⛏️' },
  alchemist: { id: 'alchemist', label: 'Herbes', emoji: '🌿' },
  farm: { id: 'farm', label: 'Ferme', emoji: '🐔' },
};

export function emptyHerbariumState() {
  return { discovered: [], seenToast: [] };
}

export function ensureHerbariumState(state) {
  if (!state.herbarium || typeof state.herbarium !== 'object') {
    state.herbarium = emptyHerbariumState();
  }
  if (!Array.isArray(state.herbarium.discovered)) state.herbarium.discovered = [];
  if (!Array.isArray(state.herbarium.seenToast)) state.herbarium.seenToast = [];
  return state.herbarium;
}

/** Ressources éligibles à l’Herbier (pas recettes cuisine / combat / merchant-only). */
export function isHerbariumResource(res) {
  if (!res?.id) return false;
  if (res.craftOnly || res.combatOnly || res.merchantOnly) return false;
  if (res.notSellable && !res.farmOnly && !res.job) return false;
  if (res.farmOnly) return true;
  if (res.job && !res.notHarvestable) return true;
  // Eau / produits ferme parfois notHarvestable + farmOnly déjà couverts
  if (res.job === 'breeder' || res.farmOnly) return true;
  return false;
}

export function getHerbariumResources(resources) {
  return Object.values(resources || {})
    .filter(isHerbariumResource)
    .sort((a, b) => {
      const ga = getResourceGroupId(a);
      const gb = getResourceGroupId(b);
      const oa = JOB_GROUP_ORDER.indexOf(ga);
      const ob = JOB_GROUP_ORDER.indexOf(gb);
      if (oa !== ob) return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob);
      const la = Number(a.requiredJobLevel) || 1;
      const lb = Number(b.requiredJobLevel) || 1;
      if (la !== lb) return la - lb;
      return String(a.name || a.id).localeCompare(String(b.name || b.id), 'fr');
    });
}

export function getResourceGroupId(res) {
  if (res?.farmOnly || res?.job === 'breeder') return 'farm';
  if (res?.job && JOB_GROUP_META[res.job]) return res.job;
  return 'farm';
}

export function isHerbariumDiscovered(state, resourceId) {
  return ensureHerbariumState(state).discovered.includes(resourceId);
}

/**
 * Enregistre une découverte. Retourne true si nouvelle.
 */
export function discoverHerbariumResource(state, resourceId) {
  if (!resourceId) return false;
  const book = ensureHerbariumState(state);
  if (book.discovered.includes(resourceId)) return false;
  book.discovered.push(resourceId);
  return true;
}

/** Remplit l’herbier depuis l’inventaire (saves existantes). */
export function backfillHerbariumFromInventory(state, resources) {
  ensureHerbariumState(state);
  const newly = [];
  const inv = state.inventory || {};
  for (const [id, qty] of Object.entries(inv)) {
    if (!(Number(qty) > 0)) continue;
    const res = resources?.[id];
    if (!isHerbariumResource(res)) continue;
    if (discoverHerbariumResource(state, id)) newly.push(id);
  }
  return newly;
}

function blurbFor(res, jobs) {
  if (res.description) return res.description;
  if (res.farmOnly || res.job === 'breeder') {
    return 'Produit de la ferme du village.';
  }
  const jobName = jobs?.[res.job]?.name || res.job || 'récolte';
  const lv = Number(res.requiredJobLevel) || 1;
  return `Ressource de ${jobName} (Nv.${lv}).`;
}

export function getHerbariumViewModel(state, resources, jobs) {
  ensureHerbariumState(state);
  backfillHerbariumFromInventory(state, resources);

  const list = getHerbariumResources(resources).map((res) => {
    const groupId = getResourceGroupId(res);
    const group = JOB_GROUP_META[groupId] || JOB_GROUP_META.farm;
    const discovered = isHerbariumDiscovered(state, res.id);
    return {
      resource: res,
      discovered,
      groupId,
      group,
      blurb: blurbFor(res, jobs),
      jobName: jobs?.[res.job]?.name || group.label,
    };
  });

  const found = list.filter((e) => e.discovered).length;
  const groups = JOB_GROUP_ORDER.map((id) => {
    const entries = list.filter((e) => e.groupId === id);
    return {
      ...JOB_GROUP_META[id],
      entries,
      found: entries.filter((e) => e.discovered).length,
      total: entries.length,
    };
  }).filter((g) => g.total > 0);

  return {
    title: 'Herbier',
    emoji: '🌿',
    description: 'Les ressources du village de To-Kirha. Chaque récolte ou produit de ferme s’inscrit ici.',
    entries: list,
    groups,
    found,
    total: list.length,
  };
}

/** Nouvelles découvertes pas encore toastées. */
export function consumeHerbariumUnlockToasts(state, resources) {
  const book = ensureHerbariumState(state);
  const toToast = [];
  for (const id of book.discovered) {
    if (book.seenToast.includes(id)) continue;
    book.seenToast.push(id);
    const res = resources?.[id];
    if (res) toToast.push(res);
  }
  return toToast;
}
