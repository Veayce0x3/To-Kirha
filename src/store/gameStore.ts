import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { Equipement, TypeVetement } from '../data/vetements';
import { ToolType } from '../data/outils';

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
  templeResetUsed:     number;   // resets manuels utilisés aujourd'hui (max 2)
  templeResetDate:     string;   // date UTC des resets (pour reset quotidien)
  templeSlotRerolls:   number[];  // rerolls utilisés par slot aujourd'hui (réinitialisé avec les quêtes)

  // Personnage (niveau 1-100, XP via Cuisine)
  personageNiveau:        number;
  personageXp:            number;
  personageXpTotal:       number;
  competencesPoints:      number; // points non dépensés
  competences:            Partial<Record<MetierId, number>>; // points dépensés par métier

  // Ferme
  puitsDerniereRecolte:      number;                    // timestamp ms de la dernière collecte d'eau
  animauxDerniereRecolte:    Record<string, number[]>;  // animalId → [timestamp ms par slot]

  // Outils (craftés par Artisan, ne sont pas dans l'inventaire)
  outils: Partial<Record<ToolType, { tierId: number; durabilite: number }>>;

  // Métiers de craft (Artisan + Alchimiste craft)
  craftMetiers: Record<'artisan' | 'alchimisteCraft', { niveau: number; xp: number; xpTotal: number }>;

  setAddress:               (address: string | null) => void;
  ajouterXp:                (metier: MetierId, xp: number) => void;
  ajouterXpPersonage:       (xp: number) => void;
  allouerCompetence:        (metier: MetierId) => void;
  retirerCompetence:        (metier: MetierId) => void;
  reinitialiserCompetences: () => void;
  setPuitsDerniereRecolte:  (timestamp: number) => void;
  setAnimauxDerniereRecolte:(animalId: string, slotIndex: number, timestamp: number) => void;
  setOutil:                 (type: ToolType, tierId: number, durabiliteMax: number) => void;
  decrementOutilDurabilite: (type: ToolType) => void;
  ajouterXpCraft:           (metier: 'artisan' | 'alchimisteCraft', xp: number) => void;
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
  completerQueteTemple:       (index: number) => void;
  resetTempleQuetes:          () => void;
  resetQueteTempleManuel:     (questIndex: number) => void;
  setChainBalances:         (kirha: number, pepites: number, vipExpiry: number) => void;
  setMetierFromChain:       (metierId: MetierId, niveau: number, xp: number, xpTotal: number) => void;
  addInventaireFromChain:   (resourceId: ResourceId, qty: number) => void;
  resetGameData:            () => void;
  forceChainSync:           (kirha: number, pepites: number, vipExpiry: number, metiers: { metierId: MetierId; niveau: number; xp: number; xpTotal: number }[], inventaire: Partial<Record<ResourceId, number>>) => void;
}

// ============================================================
// XP requis par niveau
// ============================================================

// XP requis pour passer du niveau N au niveau N+1
// Courbe quadratique : 100 × N^2 — friction dès les premiers niveaux, mur au mid-game
export function xpRequis(niveau: number): number {
  return Math.round(100 * Math.pow(niveau, 2.0));
}

// Taxe HDV selon niveau Personnage + statut VIP
// Free : 50% (Lv1) → 20% (Lv100) — VIP divise par 2 (min 10%)
export function calculerTaxeMarche(niveau: number, isVip: boolean): number {
  const reduction = 0.30 * Math.pow(Math.max(1, niveau) / 100, 0.6);
  const taxeBase = Math.max(0.10, 0.50 - reduction);
  return isVip ? Math.max(0.10, taxeBase / 2) : taxeBase;
}

// ============================================================
// Conditions de déverrouillage des slots
// ============================================================

export const SLOT_UNLOCK_CONDITIONS: Record<number, { ressources: number; kirha: number }> = {
  2:  { ressources: 5,    kirha: 2    },
  3:  { ressources: 10,   kirha: 5    },
  4:  { ressources: 15,   kirha: 8    },
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
        debloque:             i < 2,
        resource_id:          null,
        termine_a:            null,
        selected_resource_id: null,
      })),
    ])
  ) as Record<MetierId, SlotRecolte[]>;

// ============================================================
// Store — persist via localStorage
// ============================================================

function getParisDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

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
      templeResetUsed:     0,
      templeResetDate:     '',
      templeSlotRerolls:   [0, 0, 0],
      personageNiveau:     1,
      personageXp:         0,
      personageXpTotal:    0,
      competencesPoints:   0,
      competences:         {},
      puitsDerniereRecolte:   0,
      animauxDerniereRecolte: {},
      outils:                 {},
      craftMetiers: {
        artisan:         { niveau: 1, xp: 0, xpTotal: 0 },
        alchimisteCraft: { niveau: 1, xp: 0, xpTotal: 0 },
      },

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
          if (state.templeCompleted.includes(index)) return state;
          const today = getParisDate();
          return { templeCompleted: [...state.templeCompleted, index], templeCompletedDate: today };
        }),

      resetTempleQuetes: () => set({ templeCompleted: [], templeCompletedDate: '', templeSlotRerolls: [0, 0, 0] }),

      resetQueteTempleManuel: (questIndex) =>
        set((state) => {
          const today = getParisDate();
          const usedToday = state.templeResetDate === today ? state.templeResetUsed : 0;
          if (usedToday >= 2) return state;
          const newRerolls = [...(state.templeSlotRerolls ?? [0, 0, 0])];
          newRerolls[questIndex] = (newRerolls[questIndex] ?? 0) + 1;
          return {
            templeCompleted: state.templeCompleted.filter(i => i !== questIndex),
            templeSlotRerolls: newRerolls,
            templeResetUsed: usedToday + 1,
            templeResetDate: today,
          };
        }),

      setChainBalances: (kirha, pepites, vipExpiry) =>
        set((state) => ({
          // chain = source de vérité + gains PNJ non encore sauvegardés
          soldeKirha: kirha + state.kirhaEarned,
          pepitesOr:  pepites,
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

      // Réinitialise toutes les données de jeu (garde adresse, villeId, pseudo, langue)
      resetGameData: () =>
        set((state) => ({
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
          templeCompletedDate: '',
          templeCompleted:     [],
          templeResetUsed:     0,
          templeResetDate:     '',
          templeSlotRerolls:   [0, 0, 0],
          personageNiveau:     1,
          personageXp:         0,
          personageXpTotal:    0,
          competencesPoints:   0,
          competences:         {},
          puitsDerniereRecolte:   0,
          animauxDerniereRecolte: {},
          outils:                 {},
          craftMetiers: {
            artisan:         { niveau: 1, xp: 0, xpTotal: 0 },
            alchimisteCraft: { niveau: 1, xp: 0, xpTotal: 0 },
          },
          // Conserver
          address:  state.address,
          villeId:  state.villeId,
          pseudo:   state.pseudo,
          langue:   state.langue,
        })),

      // Sync forcée depuis la chaîne (écrase sans Math.max, utilisé après reset admin détecté)
      forceChainSync: (kirha, pepites, vipExpiry, metiersList, inventaire) =>
        set((state) => {
          const newMetiers = { ...state.metiers };
          for (const m of metiersList) {
            newMetiers[m.metierId] = { id: m.metierId, niveau: Math.max(1, m.niveau), xp: m.xp, xp_total: m.xpTotal };
          }
          return {
            soldeKirha: kirha,
            pepitesOr:  pepites,
            vipExpiry:  vipExpiry,
            metiers:    newMetiers,
            inventaire,
            kirhaEarned: 0,
            pending_mints: [],
          };
        }),

      ajouterXpPersonage: (xp) =>
        set((state) => {
          let niveau = state.personageNiveau;
          let xpCurrent = state.personageXp + xp;
          const xpTotal = state.personageXpTotal + xp;
          let points = state.competencesPoints;
          while (niveau < 100 && xpCurrent >= xpRequis(niveau)) {
            xpCurrent -= xpRequis(niveau);
            niveau = Math.min(100, niveau + 1);
            points += 1;
          }
          return { personageNiveau: niveau, personageXp: xpCurrent, personageXpTotal: xpTotal, competencesPoints: points };
        }),

      allouerCompetence: (metier) =>
        set((state) => {
          if (state.competencesPoints < 1) return state;
          const current = state.competences[metier] ?? 0;
          if (current >= 10) return state;
          return {
            competencesPoints: state.competencesPoints - 1,
            competences: { ...state.competences, [metier]: current + 1 },
          };
        }),

      retirerCompetence: (metier) =>
        set((state) => {
          const current = state.competences[metier] ?? 0;
          if (current < 1) return state;
          return {
            competencesPoints: state.competencesPoints + 1,
            competences: { ...state.competences, [metier]: current - 1 },
          };
        }),

      reinitialiserCompetences: () =>
        set((state) => {
          const COUT_RESET = 100;
          if (state.pepitesOr < COUT_RESET) return state;
          const totalDepenses = Object.values(state.competences).reduce((a, b) => a + (b ?? 0), 0);
          return {
            pepitesOr: state.pepitesOr - COUT_RESET,
            competencesPoints: state.competencesPoints + totalDepenses,
            competences: {},
          };
        }),

      setOutil: (type, tierId, durabiliteMax) =>
        set((state) => ({
          outils: { ...state.outils, [type]: { tierId, durabilite: durabiliteMax } },
        })),

      decrementOutilDurabilite: (type) =>
        set((state) => {
          const outil = state.outils[type];
          if (!outil || outil.durabilite <= 0) return state;
          return { outils: { ...state.outils, [type]: { ...outil, durabilite: Math.max(0, outil.durabilite - 1) } } };
        }),

      ajouterXpCraft: (metier, xp) =>
        set((state) => {
          const current = state.craftMetiers[metier];
          let niveau = current.niveau;
          let xpCurrent = current.xp + xp;
          const xpTotal = current.xpTotal + xp;
          while (niveau < 100 && xpCurrent >= xpRequis(niveau)) {
            xpCurrent -= xpRequis(niveau);
            niveau = Math.min(100, niveau + 1);
          }
          return { craftMetiers: { ...state.craftMetiers, [metier]: { niveau, xp: xpCurrent, xpTotal } } };
        }),

      setPuitsDerniereRecolte: (timestamp) => set({ puitsDerniereRecolte: timestamp }),

      setAnimauxDerniereRecolte: (animalId, slotIndex, timestamp) =>
        set((state) => {
          const current = [...(state.animauxDerniereRecolte[animalId] ?? [])];
          current[slotIndex] = timestamp;
          return { animauxDerniereRecolte: { ...state.animauxDerniereRecolte, [animalId]: current } };
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
      version: 13,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return undefined;
        const state = persistedState as Partial<GameState> & { animauxDerniereRecolte?: unknown };
        // Migration douce: garder toutes les données existantes, compléter les champs manquants
        // v9  : reset slots à 2 débloqués par métier
        // v10 : ajout personnage, compétences, ferme
        // v11 : animauxDerniereRecolte devient Record<string, number[]>, temple resets
        // v12 : ajout outils, craftMetiers (Artisan, AlchimisteCraft)
        // v13 : ajout templeSlotRerolls (reroll quêtes), dates temple Paris
        const oldRecolte = (state.animauxDerniereRecolte ?? {}) as Record<string, unknown>;
        const migratedRecolte: Record<string, number[]> = {};
        for (const [k, v] of Object.entries(oldRecolte)) {
          migratedRecolte[k] = Array.isArray(v) ? (v as number[]) : [v as number];
        }
        return {
          ...state,
          slots:               version < 9 ? initSlots() : ((state as Partial<GameState>).slots ?? initSlots()),
          pepitesOr:           (state as Partial<GameState>).pepitesOr           ?? 0,
          vipExpiry:           (state as Partial<GameState>).vipExpiry            ?? 0,
          templeCompletedDate: '',
          templeCompleted:     [],
          templeResetUsed:     0,
          templeResetDate:     '',
          templeSlotRerolls:   [0, 0, 0],
          kirhaEarned:         (state as Partial<GameState>).kirhaEarned           ?? 0,
          personageNiveau:     (state as Partial<GameState>).personageNiveau      ?? 1,
          personageXp:         (state as Partial<GameState>).personageXp          ?? 0,
          personageXpTotal:    (state as Partial<GameState>).personageXpTotal      ?? 0,
          competencesPoints:   (state as Partial<GameState>).competencesPoints     ?? 0,
          competences:         (state as Partial<GameState>).competences           ?? {},
          puitsDerniereRecolte:   (state as Partial<GameState>).puitsDerniereRecolte   ?? 0,
          animauxDerniereRecolte: migratedRecolte,
          outils:              (state as Partial<GameState>).outils               ?? {},
          craftMetiers:        (state as Partial<GameState>).craftMetiers ?? {
            artisan:         { niveau: 1, xp: 0, xpTotal: 0 },
            alchimisteCraft: { niveau: 1, xp: 0, xpTotal: 0 },
          },
        };
      },
    }
  )
);
