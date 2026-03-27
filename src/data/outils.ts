// ============================================================
// Système d'outils — To-Kirha v2
// Un outil par métier, niveau 2-10.
// Le niveau détermine l'indice max de ressource récoltable.
// Indice ressource = ((resourceId - 1) % 10) + 1
// Indice 1 = ressource libre (pas d'outil requis).
// ============================================================

export type ToolType = 'hache' | 'faucille' | 'canne' | 'pioche' | 'mortier';

/** Ressources qui ne nécessitent PAS d'outil (première de chaque métier) */
export const FREE_RESOURCE_IDS: readonly number[] = [1, 11, 21, 31, 41];

/** Durabilité max de tout outil (charges avant disparition) */
export const DURABILITE_MAX = 60;

/** Quel type d'outil est requis par chaque métier de récolte */
export const METIER_TOOL_TYPE: Record<string, ToolType> = {
  bucheron:   'hache',
  paysan:     'faucille',
  pecheur:    'canne',
  mineur:     'pioche',
  alchimiste: 'mortier',
};

export interface OutilInfo {
  emoji: string;
  nom:   string;
}

export const OUTIL_INFO: Record<ToolType, OutilInfo> = {
  hache:    { emoji: '🪓', nom: 'Hache'    },
  faucille: { emoji: '🌾', nom: 'Faucille' },
  canne:    { emoji: '🎣', nom: 'Canne'    },
  pioche:   { emoji: '⛏️', nom: 'Pioche'   },
  mortier:  { emoji: '🫙', nom: 'Mortier'  },
};

/**
 * Retourne l'indice de la ressource au sein de son métier (1-10).
 * Indice 1 = ressource libre.
 */
export function getResourceIndex(resourceId: number): number {
  return ((resourceId - 1) % 10) + 1;
}

/** Quantité d'ingrédients selon le niveau de l'outil à crafter */
function niveauQty(niveau: number): number {
  if (niveau <= 4) return 3;
  if (niveau <= 7) return 4;
  return 5;
}

export interface UpgradeIngredient {
  resourceId: number;
  quantite:   number;
}

/**
 * Retourne les ingrédients pour crafter/upgrader un outil au niveau N (2-10).
 *
 * Recette :
 *  - Bûcheron [indice N-1]  + Mineur [indice N-1]     (tous les outils)
 *  - Paysan/Pêcheur/Alchimiste [indice N-1]             (faucille/canne/mortier, N≥6 uniquement)
 *
 * Exemples :
 *  Hache   Niv 2 → 3× Frêne   (ID 1)  + 3× Pierre (ID 31)
 *  Hache   Niv 3 → 3× Séquoia (ID 2)  + 3× Charbon (ID 32)
 *  Faucille Niv6 → 4× Érable  (ID 5)  + 4× Topaze  (ID 35) + 4× Maïs (ID 15)
 */
export function getUpgradeRecipe(toolType: ToolType, niveau: number): UpgradeIngredient[] {
  if (niveau < 2 || niveau > 10) return [];
  const qty  = niveauQty(niveau);
  const idx  = niveau - 1; // indice à utiliser (N-1 dans le métier)

  const ingredients: UpgradeIngredient[] = [
    { resourceId: idx,      quantite: qty }, // Bûcheron  idx → IDs 1-9
    { resourceId: 30 + idx, quantite: qty }, // Mineur    idx → IDs 31-39
  ];

  // Ressource propre au métier (paysan/pêcheur/alchimiste) pour les niveaux ≥ 6
  if (niveau >= 6) {
    let ownId: number | null = null;
    if (toolType === 'faucille') ownId = 10 + idx; // Paysan    → IDs 11-19
    if (toolType === 'canne')    ownId = 20 + idx; // Pêcheur   → IDs 21-29
    if (toolType === 'mortier')  ownId = 40 + idx; // Alchimiste→ IDs 41-49
    if (ownId !== null) ingredients.push({ resourceId: ownId, quantite: qty });
  }

  // Parchemin de Forge (ID 78) requis pour les niveaux 8-10
  if (niveau >= 8) {
    ingredients.push({ resourceId: 78, quantite: niveau - 7 }); // Niv 8→1, 9→2, 10→3
  }

  return ingredients;
}

/** XP Artisan accordé pour la forge d'un outil au niveau donné */
export function getOutilXp(niveau: number): number {
  return niveau * 20;
}
