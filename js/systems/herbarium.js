/**
 * Herbier — collection des ressources découvertes (récolte, ferme, combat)
 * + bestiaire (monstres / boss vaincus au moins 1×).
 */

const JOB_GROUP_ORDER = ['farmer', 'lumberjack', 'fisher', 'miner', 'alchemist', 'farm', 'combat', 'bestiary'];

const JOB_GROUP_META = {
  farmer: { id: 'farmer', label: 'Agriculture', emoji: '🌾' },
  lumberjack: { id: 'lumberjack', label: 'Bois', emoji: '🪓' },
  fisher: { id: 'fisher', label: 'Pêche', emoji: '🎣' },
  miner: { id: 'miner', label: 'Mine', emoji: '⛏️' },
  alchemist: { id: 'alchemist', label: 'Herbes', emoji: '🌿' },
  farm: { id: 'farm', label: 'Ferme', emoji: '🐔' },
  combat: { id: 'combat', label: 'Butin combat', emoji: '⚔️' },
  bestiary: { id: 'bestiary', label: 'Bestiaire', emoji: '👹' },
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

/** Ressources éligibles à l’Herbier (pas recettes cuisine / merchant-only). */
export function isHerbariumResource(res) {
  if (!res?.id) return false;
  if (res.craftOnly || res.merchantOnly) return false;
  if (res.combatOnly) return true;
  if (res.notSellable && !res.farmOnly && !res.job) return false;
  if (res.farmOnly) return true;
  if (res.job && !res.notHarvestable) return true;
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
  if (res?.combatOnly) return 'combat';
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
  if (res.combatOnly) return 'Butin obtenu au combat ou en donjon.';
  if (res.farmOnly || res.job === 'breeder') {
    return 'Produit de la ferme du village.';
  }
  const jobName = jobs?.[res.job]?.name || res.job || 'récolte';
  const lv = Number(res.requiredJobLevel) || 1;
  return `Ressource de ${jobName} (Nv.${lv}).`;
}

function killKeyForFoe(foe, isBoss) {
  const enemyId = foe?.enemyId;
  if (!enemyId) return null;
  return isBoss ? `boss_${enemyId}` : enemyId;
}

function isEnemyDiscovered(state, foe, isBoss) {
  const key = killKeyForFoe(foe, isBoss);
  if (!key) return false;
  if ((state.combatKillStats?.[key] || 0) > 0) return true;
  if (isBoss && foe?.zoneId && (state.bossKills?.[foe.zoneId] || 0) > 0) return true;
  return false;
}

/** Entrées bestiaire à partir des zones de combat. */
export function getBestiaryEntries(state, combatZones) {
  const entries = [];
  for (const zone of Object.values(combatZones || {})) {
    const zoneName = zone.name || zone.id;
    for (const monster of zone.monsters || []) {
      const discovered = isEnemyDiscovered(state, monster, false);
      entries.push({
        kind: 'enemy',
        id: `bestiary_${monster.enemyId}`,
        enemyId: monster.enemyId,
        name: monster.name || monster.enemyId,
        emoji: monster.emoji || '👹',
        isBoss: false,
        zoneId: zone.id,
        zoneName,
        discovered,
        groupId: 'bestiary',
        group: JOB_GROUP_META.bestiary,
        blurb: discovered
          ? `Monstre de ${zoneName}.`
          : 'Pas encore rencontré',
        jobName: zoneName,
      });
    }
    if (zone.boss) {
      const boss = { ...zone.boss, zoneId: zone.id };
      const discovered = isEnemyDiscovered(state, boss, true)
        || (state.bossKills?.[zone.id] || 0) > 0;
      entries.push({
        kind: 'enemy',
        id: `bestiary_boss_${boss.enemyId}`,
        enemyId: boss.enemyId,
        name: boss.name || boss.enemyId,
        emoji: boss.emoji || '👑',
        isBoss: true,
        zoneId: zone.id,
        zoneName,
        discovered,
        groupId: 'bestiary',
        group: JOB_GROUP_META.bestiary,
        blurb: discovered
          ? `Boss de ${zoneName}.`
          : 'Boss pas encore vaincu',
        jobName: `Boss · ${zoneName}`,
      });
    }
  }
  return entries.sort((a, b) => {
    if (a.zoneId !== b.zoneId) return String(a.zoneId).localeCompare(String(b.zoneId));
    if (a.isBoss !== b.isBoss) return a.isBoss ? 1 : -1;
    return String(a.name).localeCompare(String(b.name), 'fr');
  });
}

export function getHerbariumViewModel(state, resources, jobs, combatZones = null) {
  ensureHerbariumState(state);
  backfillHerbariumFromInventory(state, resources);

  const resourceEntries = getHerbariumResources(resources).map((res) => {
    const groupId = getResourceGroupId(res);
    const group = JOB_GROUP_META[groupId] || JOB_GROUP_META.farm;
    const discovered = isHerbariumDiscovered(state, res.id);
    return {
      kind: 'resource',
      resource: res,
      discovered,
      groupId,
      group,
      blurb: blurbFor(res, jobs),
      jobName: res.combatOnly
        ? 'Combat'
        : (jobs?.[res.job]?.name || group.label),
    };
  });

  const bestiaryEntries = combatZones ? getBestiaryEntries(state, combatZones) : [];
  const list = [...resourceEntries, ...bestiaryEntries];

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
    description: 'Ressources du village, butin de combat et créatures rencontrées.',
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
