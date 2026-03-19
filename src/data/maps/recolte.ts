// ============================================================
// Carte Zone de Récolte — placeholder en attendant le JSON Tiled
//
// Architecture cible (Tiled) :
//   import tiledJson from '../../maps/recolte.json';
//   export const RECOLTE_GRID = collisionGridFromTiled(tiledJson);
//   export const RECOLTE_ZONES = objectsFromTiled(tiledJson, 'Zones');
//
// Pour l'instant : grille hardcodée + zones définies manuellement.
// ============================================================

import { Cell, createGrid, cellToPercent } from '../../utils/grid';

export const RECOLTE_COLS = 20;
export const RECOLTE_ROWS = 16;

// Cases bloquées : HUD haut + bords + menu bas
const BLOCKED: Cell[] = [
  // HUD
  ...Array.from({ length: RECOLTE_COLS }, (_, col) => ({ col, row: 0 })),
  // Bords gauche/droite
  ...Array.from({ length: RECOLTE_ROWS }, (_, row) => ({ col: 0, row })),
  ...Array.from({ length: RECOLTE_ROWS }, (_, row) => ({ col: RECOLTE_COLS - 1, row })),
  // Bord bas (menu)
  ...Array.from({ length: RECOLTE_COLS }, (_, col) => ({ col, row: RECOLTE_ROWS - 1 })),
  ...Array.from({ length: RECOLTE_COLS }, (_, col) => ({ col, row: RECOLTE_ROWS - 2 })),
];

export const RECOLTE_GRID = createGrid(RECOLTE_COLS, RECOLTE_ROWS, BLOCKED);

/** Le personnage arrive depuis le village en bas-centre */
export const RECOLTE_CHAR_START: Cell = { col: 10, row: 13 };

// ── Zones de récolte ────────────────────────────────────────
// Disposées comme Dofus : forêt haut-gauche, mine haut-droite,
// champs milieu-gauche, rivière bas-gauche, jardin bas-droite.

export interface RecoltZone {
  id:        string;
  label:     string;
  emoji:     string;
  couleur:   string;
  cell:      Cell;   // case cible (où le personnage marche)
  route:     string | null;  // null = pas encore implémenté
}

export const RECOLTE_ZONES: RecoltZone[] = [
  { id: 'foret',     label: 'Forêt',         emoji: '🌲', couleur: '#6abf44', cell: { col: 4,  row: 4  }, route: null },
  { id: 'mine',      label: 'Mine',           emoji: '⛏️', couleur: '#8d6e63', cell: { col: 16, row: 4  }, route: null },
  { id: 'champs',    label: 'Champs',         emoji: '🌾', couleur: '#f9a825', cell: { col: 4,  row: 9  }, route: null },
  { id: 'riviere',   label: 'Rivière',        emoji: '🎣', couleur: '#29b6f6', cell: { col: 4,  row: 13 }, route: null },
  { id: 'jardin',    label: 'Jardin Alchi.', emoji: '🌿', couleur: '#ab47bc', cell: { col: 16, row: 13 }, route: null },
  { id: 'village',   label: '← Village',     emoji: '🏯', couleur: '#ffca28', cell: { col: 10, row: 13 }, route: '/ville' },
];

export function recolteCellToPercent(cell: Cell) {
  return cellToPercent(cell.col, cell.row, RECOLTE_COLS, RECOLTE_ROWS);
}
