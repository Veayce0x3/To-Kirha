// ============================================================
// Système d'outils — To-Kirha
// Les outils sont craftés par l'Artisan et stockés dans le store.
// Ils NE sont PAS des ResourceIds dans l'inventaire.
// ============================================================

export type ToolType = 'hache' | 'faucille' | 'canne' | 'pioche' | 'mortier';

/** Ressources qui ne nécessitent PAS d'outil (première de chaque métier) */
export const FREE_RESOURCE_IDS: readonly number[] = [1, 11, 21, 31, 41];

/** Quel type d'outil est requis par chaque métier de récolte */
export const METIER_TOOL_TYPE: Record<string, ToolType> = {
  bucheron:   'hache',
  paysan:     'faucille',
  pecheur:    'canne',
  mineur:     'pioche',
  alchimiste: 'mortier',
};

export interface OutilTierInfo {
  tierId:          number;
  nom:             string;
  emoji:           string;
  durabiliteMax:   number;
  xpBonusPercent:  number; // bonus XP récolte
}

export const OUTIL_TIERS: Record<ToolType, OutilTierInfo[]> = {
  hache: [
    { tierId: 1, nom: 'Hache en Bois',   emoji: '🪓', durabiliteMax: 20, xpBonusPercent: 0  },
    { tierId: 2, nom: 'Hache en Pierre', emoji: '🪓', durabiliteMax: 40, xpBonusPercent: 10 },
    { tierId: 3, nom: 'Hache en Fer',    emoji: '🪓', durabiliteMax: 80, xpBonusPercent: 25 },
  ],
  faucille: [
    { tierId: 1, nom: 'Faucille en Pierre', emoji: '🌾', durabiliteMax: 20, xpBonusPercent: 0  },
    { tierId: 2, nom: 'Faucille en Fer',    emoji: '🌾', durabiliteMax: 40, xpBonusPercent: 10 },
    { tierId: 3, nom: 'Grande Faucille',    emoji: '🌾', durabiliteMax: 80, xpBonusPercent: 25 },
  ],
  canne: [
    { tierId: 1, nom: 'Canne en Bois',    emoji: '🎣', durabiliteMax: 20, xpBonusPercent: 0  },
    { tierId: 2, nom: 'Canne Renforcée',  emoji: '🎣', durabiliteMax: 40, xpBonusPercent: 10 },
    { tierId: 3, nom: 'Canne Sakura',     emoji: '🎣', durabiliteMax: 80, xpBonusPercent: 25 },
  ],
  pioche: [
    { tierId: 1, nom: 'Pioche en Pierre', emoji: '⛏️', durabiliteMax: 20, xpBonusPercent: 0  },
    { tierId: 2, nom: 'Pioche en Cuivre', emoji: '⛏️', durabiliteMax: 40, xpBonusPercent: 10 },
    { tierId: 3, nom: 'Pioche en Fer',    emoji: '⛏️', durabiliteMax: 80, xpBonusPercent: 25 },
  ],
  mortier: [
    { tierId: 1, nom: 'Mortier en Pierre', emoji: '🫙', durabiliteMax: 20, xpBonusPercent: 0  },
    { tierId: 2, nom: 'Mortier en Jade',   emoji: '🫙', durabiliteMax: 40, xpBonusPercent: 10 },
    { tierId: 3, nom: 'Mortier Sakura',    emoji: '🫙', durabiliteMax: 80, xpBonusPercent: 25 },
  ],
};

export function getOutilTierInfo(type: ToolType, tierId: number): OutilTierInfo | undefined {
  return OUTIL_TIERS[type].find(t => t.tierId === tierId);
}
