import { getJobLevel } from './zones.js';

function getZoneUnlockRequirements(zoneId, balance) {
  return balance.zones[zoneId]?.unlockRequirements || null;
}

export function formatZoneUnlockRequirements(zoneId, balance, resources = {}, jobs = {}, state = null) {
  const req = getZoneUnlockRequirements(zoneId, balance);
  if (!req) return [];

  const lines = [];
  if (req.minJobLevel && req.minJobId) {
    const jobName = jobs[req.minJobId]?.name || req.minJobId;
    const current = state ? getJobLevel(state, req.minJobId) : null;
    const done = current != null && current >= req.minJobLevel;
    const progress = current != null
      ? ` (toi : Nv.${current}${done ? ' ✓' : ''})`
      : '';
    lines.push(`${done ? '✓' : '🔒'} ${jobName} Nv.${req.minJobLevel}${progress}`);
  }
  if (req.resources) {
    for (const [resId, amount] of Object.entries(req.resources)) {
      const name = resources[resId]?.name || resId;
      const have = state?.inventory?.[resId] || 0;
      const done = state ? have >= amount : null;
      const progress = state != null ? ` · ${have}/${amount}` : '';
      lines.push(`${done ? '✓' : '📦'} ${amount}× ${name}${progress}`);
    }
  }
  if (req.kirha > 0) {
    const have = state?.kirha || 0;
    const done = state ? have >= req.kirha : null;
    lines.push(`${done ? '✓' : '💰'} ${req.kirha.toLocaleString('fr-FR')} Kirha${state != null ? ` · ${have.toLocaleString('fr-FR')}` : ''}`);
  }
  return lines;
}

function checkZoneResourceRequirements(req, state) {
  if (!req?.resources) return null;
  const missing = [];
  for (const [resId, amount] of Object.entries(req.resources)) {
    const have = state.inventory[resId] || 0;
    if (have < amount) missing.push({ resId, need: amount, have });
  }
  if (missing.length === 0) return null;
  return missing;
}

export function getZoneUnlockHint(zoneId, balance, combatZones = {}) {
  const req = balance.zoneBossUnlocks?.[zoneId];
  if (!req?.bossCombatZone) return null;
  const cz = combatZones[req.bossCombatZone];
  const bossName = cz?.boss?.name || 'le boss de la zone précédente';
  return `Vaincre ${bossName} pour débloquer cette zone.`;
}

export function canPayUnlockZone(zoneId, state, balance, combatZones = {}, resources = {}, jobs = {}) {
  const zone = balance.zones[zoneId];
  if (!zone) return { ok: false, reason: 'Zone inconnue' };
  if (balance.zones[zoneId]?.unlocked) return { ok: false, reason: 'Déjà accessible' };
  if ((state.unlockedZones || []).includes(zoneId)) return { ok: false, reason: 'Déjà débloquée' };

  const bossReq = balance.zoneBossUnlocks?.[zoneId];
  if (bossReq?.bossCombatZone) {
    const kills = state.bossKills?.[bossReq.bossCombatZone] || 0;
    if (kills < 1) {
      const hint = getZoneUnlockHint(zoneId, balance, combatZones);
      return { ok: false, reason: hint || 'Boss requis' };
    }
  }

  const req = getZoneUnlockRequirements(zoneId, balance) || {};
  const kirhaCost = req.kirha ?? zone.unlockCost ?? 0;

  if (req.minJobLevel && req.minJobId) {
    const jobLv = getJobLevel(state, req.minJobId);
    if (jobLv < req.minJobLevel) {
      const jobName = jobs[req.minJobId]?.name || req.minJobId;
      return {
        ok: false,
        reason: `${jobName} Nv.${req.minJobLevel} requis (actuel : Nv.${jobLv})`,
      };
    }
  }

  const missingRes = checkZoneResourceRequirements(req, state);
  if (missingRes?.length) {
    const parts = missingRes.map(({ resId, need, have }) => {
      const name = resources[resId]?.name || resId;
      return `${name} ${have}/${need}`;
    });
    return { ok: false, reason: `Ressources requises : ${parts.join(' · ')}` };
  }

  if (kirhaCost > 0 && (state.kirha || 0) < kirhaCost) {
    return { ok: false, reason: `Il manque ${kirhaCost - state.kirha} 💰` };
  }

  return { ok: true, cost: kirhaCost };
}

export function unlockWorldZone(zoneId, state, balance, combatZones = {}) {
  const check = canPayUnlockZone(zoneId, state, balance, combatZones);
  if (!check.ok) return check;

  const req = getZoneUnlockRequirements(zoneId, balance) || {};
  const cost = check.cost || 0;
  if (cost > 0) state.kirha -= cost;

  if (req.resources) {
    for (const [resId, amount] of Object.entries(req.resources)) {
      state.inventory[resId] = (state.inventory[resId] || 0) - amount;
    }
  }

  if (!state.unlockedZones) state.unlockedZones = ['village_sakura'];
  if (!state.unlockedZones.includes(zoneId)) state.unlockedZones.push(zoneId);
  return { ok: true, zoneId, cost };
}

export function tryAutoUnlockFromBoss(combatZoneId, state, balance) {
  const nextZoneId = balance.zoneBossUnlocksAfter?.[combatZoneId];
  if (!nextZoneId) return null;
  if ((state.unlockedZones || []).includes(nextZoneId)) return null;
  if (!state.unlockedZones) state.unlockedZones = ['village_sakura'];
  state.unlockedZones.push(nextZoneId);
  return nextZoneId;
}
