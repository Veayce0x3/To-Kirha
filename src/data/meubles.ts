// ============================================================
// Meubles craftables + Artefacts posables — To-Kirha
// Meubles craftables : IDs 80-86 (dans inventaire → posables)
// Artefacts meubles  : IDs 200-202 (dans store.artefacts → posables)
// Artefacts vêtements: IDs 203-204 (dans store.artefacts → équipables)
// ============================================================

import { ResourceId } from './resources';
import { MetierId } from './metiers';

export type MeubleBonusType =
  | 'qty_bucheron' | 'qty_paysan' | 'qty_pecheur' | 'qty_mineur' | 'qty_alchimiste'
  | 'qty_all' | 'eau_par_jour' | 'cooldown_animaux_pct' | 'qty_saison';

export interface MeubleBonus {
  type:   MeubleBonusType;
  valeur: number;
}

export interface MeubleRecette {
  ingredients: { resourceId: ResourceId; quantite: number }[];
}

export interface Meuble {
  id:          number;
  nom:         string;
  nomEn:       string;
  emoji:       string;
  bonus:       MeubleBonus;
  description: string;
  maxSupply?:  number;   // artefacts seulement
  recette?:    MeubleRecette; // craftables seulement
  isArtefact:  boolean;
}

export const MEUBLES: Meuble[] = [
  // ── Craftables (IDs 80-86) ──────────────────────────────
  {
    id: 80, nom: 'Table du Bûcheron', nomEn: "Lumberjack's Table", emoji: '🪵',
    bonus: { type: 'qty_bucheron', valeur: 3 },
    description: '+3% quantité récoltée Bûcheron.',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.FRENE,    quantite: 80 },
      { resourceId: ResourceId.CHENE,    quantite: 60 },
      { resourceId: ResourceId.PIERRE,   quantite: 40 },
      { resourceId: ResourceId.FER,      quantite: 20 },
    ]},
  },
  {
    id: 81, nom: 'Meule du Paysan', nomEn: "Farmer's Millstone", emoji: '🌾',
    bonus: { type: 'qty_paysan', valeur: 3 },
    description: '+3% quantité récoltée Paysan.',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.BLE,    quantite: 100 },
      { resourceId: ResourceId.SEIGLE, quantite: 60  },
      { resourceId: ResourceId.PIERRE, quantite: 50  },
    ]},
  },
  {
    id: 82, nom: 'Vivier du Pêcheur', nomEn: "Fisher's Pond", emoji: '🐟',
    bonus: { type: 'qty_pecheur', valeur: 3 },
    description: '+3% quantité récoltée Pêcheur.',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.BAMBOU,          quantite: 80 },
      { resourceId: ResourceId.PIERRE,          quantite: 60 },
      { resourceId: ResourceId.CARPE_JAPONAISE, quantite: 30 },
    ]},
  },
  {
    id: 83, nom: 'Enclume du Mineur', nomEn: "Miner's Anvil", emoji: '⛏️',
    bonus: { type: 'qty_mineur', valeur: 3 },
    description: '+3% quantité récoltée Mineur.',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.FER,    quantite: 100 },
      { resourceId: ResourceId.CUIVRE, quantite: 60  },
      { resourceId: ResourceId.JADE,   quantite: 20  },
    ]},
  },
  {
    id: 84, nom: 'Alambic Alchimiste', nomEn: "Alchemist's Alembic", emoji: '🌺',
    bonus: { type: 'qty_alchimiste', valeur: 3 },
    description: '+3% quantité récoltée Alchimiste.',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.CHRYSANTHEME, quantite: 80 },
      { resourceId: ResourceId.WISTERIA,     quantite: 60 },
      { resourceId: ResourceId.JADE,         quantite: 30 },
    ]},
  },
  {
    id: 85, nom: 'Bassin à Koï', nomEn: 'Koi Basin', emoji: '🐠',
    bonus: { type: 'eau_par_jour', valeur: 1 },
    description: '+1 Eau par jour (Puits).',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.JADE,          quantite: 40 },
      { resourceId: ResourceId.CERISIER_DORE, quantite: 30 },
      { resourceId: ResourceId.DIAMANT,       quantite: 10 },
    ]},
  },
  {
    id: 86, nom: 'Abreuvoir Sakura', nomEn: 'Sakura Trough', emoji: '🍶',
    bonus: { type: 'cooldown_animaux_pct', valeur: 10 },
    description: '-10% temps de recharge de tous les animaux.',
    isArtefact: false,
    recette: { ingredients: [
      { resourceId: ResourceId.FER,    quantite: 60 },
      { resourceId: ResourceId.SEIGLE, quantite: 40 },
      { resourceId: ResourceId.LAIT,   quantite: 20 },
    ]},
  },
  // ── Artefacts meubles (IDs 200-202) ─────────────────────
  {
    id: 200, nom: 'Trône Impérial du Samouraï', nomEn: "Samurai's Imperial Throne", emoji: '🏯',
    bonus: { type: 'qty_all', valeur: 5 },
    description: '+5% quantité sur tous les métiers de récolte.',
    maxSupply: 20,
    isArtefact: true,
  },
  {
    id: 201, nom: 'Fontaine Sacrée', nomEn: 'Sacred Fountain', emoji: '⛲',
    bonus: { type: 'eau_par_jour', valeur: 2 },
    description: '+2 Eau par jour (Puits).',
    maxSupply: 30,
    isArtefact: true,
  },
  {
    id: 202, nom: 'Sanctuaire des Récoltes', nomEn: 'Harvest Sanctuary', emoji: '🌸',
    bonus: { type: 'qty_saison', valeur: 8 },
    description: '+8% quantité sur le métier actif de saison.',
    maxSupply: 25,
    isArtefact: true,
  },
];

// Artefacts vêtements (IDs 203-204) sont définis dans vetements.ts

export interface BonusMeubles {
  qty_bucheron:         number;
  qty_paysan:           number;
  qty_pecheur:          number;
  qty_mineur:           number;
  qty_alchimiste:       number;
  qty_all:              number;
  eau_par_jour:         number;
  cooldown_animaux_pct: number;
  qty_saison:           number;
}

export function calculerBonusMeubles(posesIds: number[]): BonusMeubles {
  const totaux: BonusMeubles = {
    qty_bucheron: 0, qty_paysan: 0, qty_pecheur: 0,
    qty_mineur: 0, qty_alchimiste: 0, qty_all: 0,
    eau_par_jour: 0, cooldown_animaux_pct: 0, qty_saison: 0,
  };
  for (const id of posesIds) {
    const m = MEUBLES.find(m => m.id === id);
    if (!m) continue;
    totaux[m.bonus.type] += m.bonus.valeur;
  }
  return totaux;
}

export function getMeubleById(id: number): Meuble | undefined {
  return MEUBLES.find(m => m.id === id);
}

export function getMetierBonusMeuble(metier: MetierId, bonus: BonusMeubles): number {
  const specific: Record<MetierId, number> = {
    bucheron:   bonus.qty_bucheron,
    paysan:     bonus.qty_paysan,
    pecheur:    bonus.qty_pecheur,
    mineur:     bonus.qty_mineur,
    alchimiste: bonus.qty_alchimiste,
  };
  return (specific[metier] ?? 0) + bonus.qty_all;
}
