import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';

// ============================================================
// Types
// ============================================================

export interface MetierProgress {
  id:        MetierId;
  niveau:    number;
  xp:        number;
  xp_total:  number;
}

export interface SlotRecolte {
  index:      number;
  debloque:   boolean;
  resource_id: ResourceId | null;
  termine_a:  number | null; // timestamp ms
}

export interface PendingMint {
  resource_id: ResourceId;
  quantite:    number;
}

export interface GameState {
  address:            string | null;
  metiers:            Record<MetierId, MetierProgress>;
  slots:              SlotRecolte[];
  inventaire:         Partial<Record<ResourceId, number>>;
  pending_mints:      PendingMint[];
  derniere_sauvegarde: number | null;

  setAddress:          (address: string | null) => void;
  ajouterXp:           (metier: MetierId, xp: number) => void;
  demarrerRecolte:     (slotIndex: number, resourceId: ResourceId, dureeMs: number) => void;
  terminerRecolte:     (slotIndex: number, quantite: number) => void;
  ajouterPendingMint:  (resourceId: ResourceId, quantite: number) => void;
  viderPendingMints:   () => void;
  setSauvegarde:       (timestamp: number) => void;
}

// ============================================================
// XP requis par niveau
// ============================================================

const XP_TABLE: Record<number, number> = {
  1: 100, 10: 300, 20: 600, 30: 1000,
  40: 1500, 50: 2200, 60: 3000, 70: 4000,
  80: 5500, 90: 7500,
};

export function xpRequis(niveau: number): number {
  const palier = Math.floor(niveau / 10) * 10;
  return XP_TABLE[palier] ?? 500;
}

// ============================================================
// Init
// ============================================================

const METIER_IDS: MetierId[] = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'];

const initMetier = (id: MetierId): MetierProgress => ({
  id, niveau: 1, xp: 0, xp_total: 0,
});

const initSlots = (): SlotRecolte[] =>
  Array.from({ length: 10 }, (_, i) => ({
    index: i,
    debloque: i === 0,
    resource_id: null,
    termine_a: null,
  }));

// ============================================================
// Store — persist via localStorage (web natif)
// ============================================================

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      address:             null,
      metiers:             Object.fromEntries(METIER_IDS.map(id => [id, initMetier(id)])) as Record<MetierId, MetierProgress>,
      slots:               initSlots(),
      inventaire:          {},
      pending_mints:       [],
      derniere_sauvegarde: null,

      setAddress: (address) => set({ address }),

      ajouterXp: (metier, xp) =>
        set((state) => {
          const p = { ...state.metiers[metier] };
          p.xp += xp;
          p.xp_total += xp;
          while (p.niveau < 100 && p.xp >= xpRequis(p.niveau)) {
            p.xp -= xpRequis(p.niveau);
            p.niveau = Math.min(100, p.niveau + 1);
          }
          return { metiers: { ...state.metiers, [metier]: p } };
        }),

      demarrerRecolte: (slotIndex, resourceId, dureeMs) =>
        set((state) => {
          const slots = [...state.slots];
          slots[slotIndex] = { ...slots[slotIndex], resource_id: resourceId, termine_a: Date.now() + dureeMs };
          return { slots };
        }),

      terminerRecolte: (slotIndex, quantite) =>
        set((state) => {
          const slot = state.slots[slotIndex];
          if (!slot.resource_id) return state;
          const resourceId = slot.resource_id;
          const slots = [...state.slots];
          slots[slotIndex] = { ...slots[slotIndex], resource_id: null, termine_a: null };
          const inventaire = { ...state.inventaire };
          inventaire[resourceId] = (inventaire[resourceId] ?? 0) + quantite;
          return { slots, inventaire };
        }),

      ajouterPendingMint: (resourceId, quantite) =>
        set((state) => {
          const existing = state.pending_mints.find(p => p.resource_id === resourceId);
          if (existing) {
            return { pending_mints: state.pending_mints.map(p => p.resource_id === resourceId ? { ...p, quantite: p.quantite + quantite } : p) };
          }
          return { pending_mints: [...state.pending_mints, { resource_id: resourceId, quantite }] };
        }),

      viderPendingMints:  () => set({ pending_mints: [] }),
      setSauvegarde:      (timestamp) => set({ derniere_sauvegarde: timestamp }),
    }),
    {
      name: 'to-kirha-game',
      // Zustand utilise localStorage par défaut sur le web
    }
  )
);
