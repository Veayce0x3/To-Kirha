import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { Equipement, TypeVetement } from '../data/vetements';

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
  index:                number;
  debloque:             boolean;
  resource_id:          ResourceId | null;
  termine_a:            number | null; // timestamp ms
  selected_resource_id: ResourceId | null;
}

export interface PendingMint {
  resource_id: ResourceId;
  quantite:    number;
}

export interface GameState {
  address:             string | null;
  metiers:             Record<MetierId, MetierProgress>;
  slots:               Record<MetierId, SlotRecolte[]>;
  inventaire:          Partial<Record<ResourceId, number>>;
  pending_mints:       PendingMint[];
  derniere_sauvegarde: number | null;
  equipement:          Equipement;
  soldeKirha:          number;
  kirhaEarned:         number; // $KIRHA gagné (PNJ) depuis la dernière sauvegarde on-chain
  pepitesOr:           number;
  vipExpiry:           number; // timestamp en secondes, 0 = pas VIP
  villeId:             string;
  langue:              'fr' | 'en';
  pseudo:              string | null;
  templeCompletedDate: string;   // date ISO du jour (UTC) des quêtes complétées
  templeCompleted:     number[]; // indices des quêtes complétées ce jour

  setAddress:               (address: string | null) => void;
  ajouterXp:                (metier: MetierId, xp: number) => void;
  demarrerRecolte:          (metier: MetierId, slotIndex: number, resourceId: ResourceId, dureeMs: number) => void;
  terminerRecolte:          (metier: MetierId, slotIndex: number, quantite: number) => void;
  ajouterPendingMint:       (resourceId: ResourceId, quantite: number) => void;
  viderPendingMints:        () => void;
  soustraireMintesPending:  (items: PendingMint[]) => void;
  setSauvegarde:            (timestamp: number) => void;
  equipVetement:            (type: TypeVetement, id: number | undefined) => void;
  vendreAuPnj:              (resourceId: ResourceId, quantite: number, prix: number) => void;
  setLangue:                (langue: 'fr' | 'en') => void;
  setSlotSelectedResource:  (metier: MetierId, slotIndex: number, resourceId: ResourceId | null) => void;
  debloquerSlot:            (metier: MetierId, slotIndex: number) => void;
  setPseudo:                (pseudo: string) => void;
  retirerKirha:             (montant: number) => void;
  ajouterKirha:             (montant: number) => void;
  resetKirhaEarned:         () => void;
  retirerRessource:         (resourceId: ResourceId, quantite: number) => void;
  ajouterRessource:         (resourceId: ResourceId, quantite: number) => void;
  setVilleId:               (villeId: string) => void;
  setVipExpiry:             (expiry: number) => void;
  setPepitesOr:             (amount: number) => void;
  ajouterPepites:           (amount: number) => void;
  retirerPepites:           (amount: number) => void;
  completerQueteTemple:     (index: number) => void;
  setChainBalances:         (kirha: number, pepites: number, vipExpiry: number) => void;
  setMetierFromChain:       (metierId: MetierId, niveau: number, xp: number, xpTotal: number) => void;
  addInventaireFromChain:   (resourceId: ResourceId, qty: number) => void;
}

// ============================================================
// XP requis par niveau
// ============================================================

export function xpRequis(niveau: number): number {
  return niveau * 100;
}

// ============================================================
// Conditions de déverrouillage des slots
// ============================================================

export const SLOT_UNLOCK_CONDITIONS: Record<number, { ressources: number; kirha: number }> = {
  5:  { ressources: 20,   kirha: 10   },
  6:  { ressources: 40,   kirha: 20   },
  7:  { ressources: 80,   kirha: 40   },
  8:  { ressources: 150,  kirha: 75   },
  9:  { ressources: 250,  kirha: 120  },
  10: { ressources: 400,  kirha: 200  },
  11: { ressources: 600,  kirha: 300  },
  12: { ressources: 900,  kirha: 450  },
  13: { ressources: 1200, kirha: 600  },
  14: { ressources: 1600, kirha: 800  },
  15: { ressources: 2000, kirha: 1000 },
  16: { ressources: 2500, kirha: 1250 },
  17: { ressources: 3000, kirha: 1500 },
  18: { ressources: 3500, kirha: 1750 },
  19: { ressources: 4000, kirha: 2000 },
};

// ============================================================
// Init
// ============================================================

const METIER_IDS: MetierId[] = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'];

const initMetier = (id: MetierId): MetierProgress => ({
  id, niveau: 1, xp: 0, xp_total: 0,
});

const initSlots = (): Record<MetierId, SlotRecolte[]> =>
  Object.fromEntries(
    METIER_IDS.map(id => [id,
      Array.from({ length: 20 }, (_, i) => ({
        index:                i,
        debloque:             i < 5,
        resource_id:          null,
        termine_a:            null,
        selected_resource_id: null,
      })),
    ])
  ) as Record<MetierId, SlotRecolte[]>;

// ============================================================
// Store — persist via localStorage
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
      equipement:          {},
      soldeKirha:          0,
      kirhaEarned:         0,
      pepitesOr:           0,
      vipExpiry:           0,
      villeId:             '',
      langue:              'fr',
      pseudo:              null,
      templeCompletedDate: '',
      templeCompleted:     [],

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

      demarrerRecolte: (metier, slotIndex, resourceId, dureeMs) =>
        set((state) => {
          const metierSlots = [...state.slots[metier]];
          metierSlots[slotIndex] = { ...metierSlots[slotIndex], resource_id: resourceId, termine_a: Date.now() + dureeMs };
          return { slots: { ...state.slots, [metier]: metierSlots } };
        }),

      terminerRecolte: (metier, slotIndex, quantite) =>
        set((state) => {
          const metierSlots = [...state.slots[metier]];
          const slot = metierSlots[slotIndex];
          if (!slot.resource_id) return state;
          const resourceId = slot.resource_id;
          metierSlots[slotIndex] = { ...metierSlots[slotIndex], resource_id: null, termine_a: null };
          const inventaire = { ...state.inventaire };
          const raw = (inventaire[resourceId] ?? 0) + quantite;
          inventaire[resourceId] = Math.round(raw * 1e10) / 1e10;
          return { slots: { ...state.slots, [metier]: metierSlots }, inventaire };
        }),

      ajouterPendingMint: (resourceId, quantite) =>
        set((state) => {
          const existing = state.pending_mints.find(p => p.resource_id === resourceId);
          if (existing) {
            return { pending_mints: state.pending_mints.map(p => p.resource_id === resourceId ? { ...p, quantite: Math.round((p.quantite + quantite) * 1e10) / 1e10 } : p) };
          }
          return { pending_mints: [...state.pending_mints, { resource_id: resourceId, quantite }] };
        }),

      viderPendingMints: () => set({ pending_mints: [] }),

      soustraireMintesPending: (items) =>
        set((state) => {
          const updated = state.pending_mints
            .map(p => {
              const minted = items.find(i => i.resource_id === p.resource_id);
              if (!minted) return p;
              const remaining = Math.round((p.quantite - minted.quantite) * 1e10) / 1e10;
              return { ...p, quantite: remaining };
            })
            .filter(p => p.quantite > 0);
          return { pending_mints: updated };
        }),

      setSauvegarde: (timestamp) => set({ derniere_sauvegarde: timestamp }),

      equipVetement: (type, id) =>
        set((state) => ({
          equipement: { ...state.equipement, [type]: id },
        })),

      vendreAuPnj: (resourceId, quantite, prix) =>
        set((state) => {
          const inventaire = { ...state.inventaire };
          const current = inventaire[resourceId] ?? 0;
          const vendu = Math.min(current, quantite);
          if (vendu <= 0) return state;
          inventaire[resourceId] = Math.round(((inventaire[resourceId] ?? 0) - vendu) * 1e10) / 1e10;
          const gain = prix * vendu;
          return {
            inventaire,
            soldeKirha:  Math.round((state.soldeKirha + gain) * 1e10) / 1e10,
            kirhaEarned: Math.round((state.kirhaEarned + gain) * 1e10) / 1e10,
          };
        }),

      setLangue: (langue) => set({ langue }),

      setPseudo: (pseudo) => set({ pseudo }),

      retirerKirha: (montant) =>
        set((state) => ({
          soldeKirha: Math.max(0, Math.round((state.soldeKirha - montant) * 1e10) / 1e10),
        })),

      ajouterKirha: (montant) =>
        set((state) => ({
          soldeKirha: Math.round((state.soldeKirha + montant) * 1e10) / 1e10,
        })),

      retirerRessource: (resourceId, quantite) =>
        set((state) => {
          const inventaire = { ...state.inventaire };
          const current = inventaire[resourceId] ?? 0;
          inventaire[resourceId] = Math.max(0, Math.round((current - quantite) * 1e10) / 1e10);
          return { inventaire };
        }),

      ajouterRessource: (resourceId, quantite) =>
        set((state) => {
          const inventaire = { ...state.inventaire };
          const current = inventaire[resourceId] ?? 0;
          inventaire[resourceId] = Math.round((current + quantite) * 1e10) / 1e10;
          return { inventaire };
        }),

      setVilleId: (villeId) => set({ villeId }),

      resetKirhaEarned: () => set({ kirhaEarned: 0 }),

      setVipExpiry: (expiry) => set({ vipExpiry: expiry }),

      setPepitesOr: (amount) => set({ pepitesOr: amount }),

      ajouterPepites: (amount) =>
        set((state) => ({ pepitesOr: Math.round((state.pepitesOr + amount) * 1e10) / 1e10 })),

      retirerPepites: (amount) =>
        set((state) => ({ pepitesOr: Math.max(0, Math.round((state.pepitesOr - amount) * 1e10) / 1e10) })),

      completerQueteTemple: (index) =>
        set((state) => {
          const today = new Date().toISOString().slice(0, 10);
          const completed = state.templeCompletedDate === today
            ? [...state.templeCompleted]
            : [];
          if (completed.includes(index)) return state;
          return { templeCompletedDate: today, templeCompleted: [...completed, index] };
        }),

      setChainBalances: (kirha, pepites, vipExpiry) =>
        set((state) => ({
          soldeKirha: Math.max(state.soldeKirha, kirha),
          pepitesOr:  Math.max(state.pepitesOr, pepites),
          vipExpiry:  Math.max(state.vipExpiry, vipExpiry),
        })),

      setMetierFromChain: (metierId, niveau, xp, xpTotal) =>
        set((state) => {
          const current = state.metiers[metierId];
          if (niveau <= current.niveau && xpTotal <= current.xp_total) return state;
          return { metiers: { ...state.metiers, [metierId]: { ...current, niveau: Math.max(current.niveau, niveau), xp_total: Math.max(current.xp_total, xpTotal), xp: niveau > current.niveau ? xp : current.xp } } };
        }),

      addInventaireFromChain: (resourceId, qty) =>
        set((state) => {
          if (qty <= 0) return state;
          const inventaire = { ...state.inventaire };
          const current = inventaire[resourceId] ?? 0;
          inventaire[resourceId] = Math.max(current, qty);
          return { inventaire };
        }),

      setSlotSelectedResource: (metier, slotIndex, resourceId) =>
        set((state) => {
          const metierSlots = [...state.slots[metier]];
          metierSlots[slotIndex] = { ...metierSlots[slotIndex], selected_resource_id: resourceId };
          return { slots: { ...state.slots, [metier]: metierSlots } };
        }),

      debloquerSlot: (metier, slotIndex) =>
        set((state) => {
          const cond = SLOT_UNLOCK_CONDITIONS[slotIndex];
          if (!cond) return state;
          const totalInv = Object.values(state.inventaire).reduce((a, b) => a + Math.floor(b ?? 0), 0);
          if (totalInv < cond.ressources || state.soldeKirha < cond.kirha) return state;
          // Déduire les coûts
          const newSolde = state.soldeKirha - cond.kirha;
          // Retirer les ressources proportionnellement (simplification : retirer des premières)
          const inventaire = { ...state.inventaire };
          let resRestantes = cond.ressources;
          for (const [rid, qty] of Object.entries(inventaire)) {
            if (resRestantes <= 0) break;
            const q = Math.floor(qty ?? 0);
            const retire = Math.min(q, resRestantes);
            inventaire[Number(rid) as ResourceId] = (qty ?? 0) - retire;
            resRestantes -= retire;
          }
          const metierSlots = [...state.slots[metier]];
          metierSlots[slotIndex] = { ...metierSlots[slotIndex], debloque: true };
          return { slots: { ...state.slots, [metier]: metierSlots }, soldeKirha: newSolde, inventaire };
        }),
    }),
    {
      name: 'to-kirha-game',
      version: 8,
      migrate: (persistedState: unknown, _version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return undefined;
        const state = persistedState as Partial<GameState>;
        // Migration douce: garder toutes les données existantes, compléter les champs manquants
        return {
          ...state,
          // S'assurer que les nouveaux champs existent
          pepitesOr:           state.pepitesOr           ?? 0,
          vipExpiry:           state.vipExpiry            ?? 0,
          templeCompletedDate: state.templeCompletedDate  ?? '',
          templeCompleted:     state.templeCompleted       ?? [],
          kirhaEarned:         state.kirhaEarned           ?? 0,
        };
      },
    }
  )
);
