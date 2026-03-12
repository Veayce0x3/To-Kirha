import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { METIERS, Ressource, MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';

// ============================================================
// Types
// ============================================================

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
  demarrer:               (slotIndex: number, resourceId: ResourceId) => void;
  collecter:              (slotIndex: number) => void;
}

// ============================================================
// Quantité récoltée selon rareté
// ============================================================

function quantiteRecolte(r: Ressource): number {
  switch (r.rarete) {
    case 'legendaire': return 1;
    case 'epique':     return 2;
    case 'rare':       return 3;
    default:           return 5;
  }
}

// ============================================================
// Hook
// ============================================================

export function useHarvest(metierId: MetierId): UseHarvestReturn {
  const metier          = METIERS[metierId];
  const slots_store     = useGameStore(s => s.slots);
  const metier_progress = useGameStore(s => s.metiers[metierId]);
  const demarrerRecolte = useGameStore(s => s.demarrerRecolte);
  const terminerRecolte = useGameStore(s => s.terminerRecolte);
  const ajouterXp       = useGameStore(s => s.ajouterXp);
  const ajouterPending  = useGameStore(s => s.ajouterPendingMint);

  // Tick 1s pour rafraîchir les timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const slots: SlotAvecTimer[] = slots_store.map(slot => {
    if (!slot.termine_a || !slot.resource_id) {
      return { index: slot.index, debloque: slot.debloque, resource_id: null, secondes_restantes: null, prete: false };
    }
    const diff = slot.termine_a - Date.now();
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

  const demarrer = useCallback((slotIndex: number, resourceId: ResourceId) => {
    const ressource = metier.ressources.find(r => r.id === resourceId);
    if (!ressource) return;
    const slot = slots_store[slotIndex];
    if (!slot.debloque || slot.resource_id !== null) return;
    demarrerRecolte(slotIndex, resourceId, ressource.temps_recolte_secondes * 1000);
  }, [slots_store, metier.ressources, demarrerRecolte]);

  const collecter = useCallback((slotIndex: number) => {
    const slot = slots_store[slotIndex];
    if (!slot.resource_id || !slot.termine_a || Date.now() < slot.termine_a) return;
    const ressource = metier.ressources.find(r => r.id === slot.resource_id);
    if (!ressource) return;
    const qte = quantiteRecolte(ressource);
    terminerRecolte(slotIndex, qte);
    ajouterXp(metierId, ressource.xp_recolte);
    ajouterPending(ressource.id, qte);
  }, [slots_store, metier.ressources, metierId, terminerRecolte, ajouterXp, ajouterPending]);

  return {
    slots,
    ressources_disponibles,
    niveau: metier_progress.niveau,
    xp:     metier_progress.xp,
    demarrer,
    collecter,
  };
}

// ============================================================
// Helpers
// ============================================================

export function formatTimer(secondes: number): string {
  const m = Math.floor(secondes / 60).toString().padStart(2, '0');
  const s = (secondes % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
