import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { METIERS, Ressource, MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { calculerBonus } from '../data/vetements';
import { FREE_RESOURCE_IDS, METIER_TOOL_TYPE, getResourceIndex } from '../data/outils';

export interface SlotAvecTimer {
  index:              number;
  debloque:           boolean;
  resource_id:        ResourceId | null;
  secondes_restantes: number | null;
  prete:              boolean;
}

export interface UseHarvestReturn {
  slots:                  SlotAvecTimer[];
  ressources_disponibles: Ressource[];
  niveau:                 number;
  xp:                     number;
  lastHarvested:          { qty: number; resourceId: ResourceId } | null;
  outilManquant:          boolean; // true si un outil est requis mais absent/cassé
  // Plante une ressource sur le slot (fonctionne même si slot déjà actif → change la ressource)
  planterRessource:       (slotIndex: number, resourceId: ResourceId) => void;
  // Récolte le slot prêt puis relance automatiquement avec la même ressource
  collecterEtRelancer:    (slotIndex: number) => void;
}

function quantiteRecolte(_niveauJoueur: number): number {
  return 0.2;
}

export function useHarvest(metierId: MetierId): UseHarvestReturn {
  const metier                  = METIERS[metierId];
  const slots_store             = useGameStore(s => s.slots[metierId]);
  const metier_progress         = useGameStore(s => s.metiers[metierId]);
  const equipement              = useGameStore(s => s.equipement);
  const outils                  = useGameStore(s => s.outils);
  const demarrerRecolte         = useGameStore(s => s.demarrerRecolte);
  const terminerRecolte         = useGameStore(s => s.terminerRecolte);
  const ajouterXp               = useGameStore(s => s.ajouterXp);
  const ajouterPending          = useGameStore(s => s.ajouterPendingMint);
  const decrementOutilDurabilite = useGameStore(s => s.decrementOutilDurabilite);
  const vipExpiry               = useGameStore(s => s.vipExpiry);
  const isVip = vipExpiry > 0 && vipExpiry > Math.floor(Date.now() / 1000);

  const toolType = METIER_TOOL_TYPE[metierId];
  const outil = outils[toolType];
  // Outil disponible : existe et non cassé (durabilite > 0 ; outil disparaît à 0 via store)
  const outilDisponible = !!outil && outil.durabilite > 0;

  const bonus = calculerBonus(equipement);

  const competences = useGameStore(s => s.competences);

  const slotsRef               = useRef(slots_store);
  const bonusRef               = useRef(bonus);
  const metierProgressRef      = useRef(metier_progress);
  const competencesRef         = useRef(competences);
  const outilDisponibleRef     = useRef(outilDisponible);
  const outilRef               = useRef(outil);
  const isVipRef               = useRef(isVip);
  slotsRef.current             = slots_store;
  bonusRef.current             = bonus;
  metierProgressRef.current    = metier_progress;
  competencesRef.current       = competences;
  outilDisponibleRef.current   = outilDisponible;
  outilRef.current             = outil;
  isVipRef.current             = isVip;

  const [, setTick] = useState(0);
  const [lastHarvested, setLastHarvested] = useState<{ qty: number; resourceId: ResourceId } | null>(null);
  const lastHarvestedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick 1s — uniquement pour rafraîchir les timers affichés (pas d'auto-collect)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metierId]);

  const slots: SlotAvecTimer[] = slots_store.map(slot => {
    if (!slot.termine_a || !slot.resource_id) {
      return { index: slot.index, debloque: slot.debloque, resource_id: null, secondes_restantes: null, prete: false };
    }
    const diff  = slot.termine_a - Date.now();
    const prete = diff <= 0;
    return {
      index:              slot.index,
      debloque:           slot.debloque,
      resource_id:        slot.resource_id,
      secondes_restantes: prete ? 0 : Math.ceil(diff / 1000),
      prete,
    };
  });

  const ressources_disponibles = metier.ressources.filter(r => r.niveau_requis <= metier_progress.niveau);

  // Plante (ou replante) une ressource sur n'importe quel slot débloqué
  const planterRessource = useCallback((slotIndex: number, resourceId: ResourceId) => {
    const slot = slotsRef.current[slotIndex];
    if (!slot.debloque) return;
    const ressource = metier.ressources.find(r => r.id === resourceId);
    if (!ressource || ressource.niveau_requis > metierProgressRef.current.niveau) return;
    // Vérification outil : requis pour toute ressource non-libre
    if (!FREE_RESOURCE_IDS.includes(resourceId)) {
      const o = outilRef.current;
      if (!o || o.durabilite <= 0 || o.niveau < getResourceIndex(resourceId)) return;
    }
    demarrerRecolte(metierId, slotIndex, resourceId, ressource.temps_recolte_secondes * 1000);
  }, [metier.ressources, metierId, demarrerRecolte]);

  // Récolte le slot (s'il est prêt) puis relance immédiatement avec la même ressource
  const collecterEtRelancer = useCallback((slotIndex: number) => {
    const slot = slotsRef.current[slotIndex];
    if (!slot.resource_id || !slot.termine_a || Date.now() < slot.termine_a) return;
    const rid      = slot.resource_id;
    const ressource = metier.ressources.find(r => r.id === rid);
    if (!ressource) return;
    const compBonus   = (competencesRef.current[metierId] ?? 0) * 5; // +5% par point
    const vipBonus    = isVipRef.current ? 0.25 : 0;                 // VIP +25% XP métier
    const ratio       = Math.round(quantiteRecolte(metierProgressRef.current.niveau) * (1 + compBonus / 100) * 1e10) / 1e10;
    const xpFinal     = Math.round(ressource.xp_recolte * (1 + bonusRef.current.xp_bonus / 100) * (1 + compBonus / 100) * (1 + vipBonus));
    // Collecter
    terminerRecolte(metierId, slotIndex, ratio);
    ajouterXp(metierId, xpFinal);
    ajouterPending(rid, ratio);
    setLastHarvested(prev => {
      if (prev && prev.resourceId === rid) return { qty: prev.qty + ratio, resourceId: rid };
      return { qty: ratio, resourceId: rid };
    });
    if (lastHarvestedTimerRef.current) clearTimeout(lastHarvestedTimerRef.current);
    lastHarvestedTimerRef.current = setTimeout(() => setLastHarvested(null), 2000);
    // Décrémenter la durabilité de l'outil (sauf ressource libre)
    if (!FREE_RESOURCE_IDS.includes(rid)) {
      decrementOutilDurabilite(toolType);
    }
    // Relancer avec la même ressource (seulement si outil encore disponible après décrémentation)
    demarrerRecolte(metierId, slotIndex, rid, ressource.temps_recolte_secondes * 1000);
  }, [metier.ressources, metierId, toolType, terminerRecolte, ajouterXp, ajouterPending, demarrerRecolte, decrementOutilDurabilite]);

  // outilManquant : vrai si des ressources non-libres sont disponibles mais outil manque, cassé, ou niveau insuffisant
  const hasNonFreeResources = metier.ressources.some(r => !FREE_RESOURCE_IDS.includes(r.id) && r.niveau_requis <= metier_progress.niveau);
  const maxResourceIndexAvailable = hasNonFreeResources
    ? metier.ressources
        .filter(r => !FREE_RESOURCE_IDS.includes(r.id) && r.niveau_requis <= metier_progress.niveau)
        .reduce((max, r) => Math.max(max, getResourceIndex(r.id)), 0)
    : 0;
  const outilManquant = hasNonFreeResources && (
    !outilDisponible || (outil !== undefined && outil.niveau < maxResourceIndexAvailable)
  );

  return {
    slots,
    ressources_disponibles,
    niveau:           metier_progress.niveau,
    xp:               metier_progress.xp,
    lastHarvested,
    outilManquant,
    planterRessource,
    collecterEtRelancer,
  };
}

export function formatTimer(secondes: number): string {
  const m = Math.floor(secondes / 60).toString().padStart(2, '0');
  const s = (secondes % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
