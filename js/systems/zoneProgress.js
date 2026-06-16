export function getZoneUnlockHint(zoneId, balance, combatZones = {}) {
  const req = balance.zoneBossUnlocks?.[zoneId];
  if (!req?.bossCombatZone) return null;
  const cz = combatZones[req.bossCombatZone];
  const bossName = cz?.boss?.name || 'le boss de la zone précédente';
  return `Vaincre ${bossName} pour débloquer cette zone.`;
}

export function canPayUnlockZone(zoneId, state, balance, combatZones = {}) {
  const zone = balance.zones[zoneId];
  if (!zone) return { ok: false, reason: 'Zone inconnue' };
  if (balance.zones[zoneId]?.unlocked) return { ok: false, reason: 'Déjà accessible' };
  if ((state.unlockedZones || []).includes(zoneId)) return { ok: false, reason: 'Déjà débloquée' };

  const req = balance.zoneBossUnlocks?.[zoneId];
  if (req?.bossCombatZone) {
    const kills = state.bossKills?.[req.bossCombatZone] || 0;
    if (kills < 1) {
      const hint = getZoneUnlockHint(zoneId, balance, combatZones);
      return { ok: false, reason: hint || 'Boss requis' };
    }
  }

  const cost = zone.unlockCost ?? 0;
  if (cost > 0 && (state.kirha || 0) < cost) {
    return { ok: false, reason: `Il manque ${cost - state.kirha} 💰` };
  }

  return { ok: true, cost };
}

export function unlockWorldZone(zoneId, state, balance, combatZones = {}) {
  const check = canPayUnlockZone(zoneId, state, balance, combatZones);
  if (!check.ok) return check;

  const cost = check.cost || 0;
  if (cost > 0) state.kirha -= cost;
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
