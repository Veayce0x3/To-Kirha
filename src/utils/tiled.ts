// ============================================================
// Parser pour maps exportées depuis Tiled (mapeditor.org)
// Format JSON standard avec calques nommés :
//   "Background"  → calque visuel sol
//   "Decorations" → calque visuel décors
//   "Collisions"  → calque pathfinding (tile > 0 = bloqué)
//   "Zones"       → calque objets interactifs (objectgroup)
// ============================================================

import { Grid } from './grid';

// ── Types Tiled JSON ─────────────────────────────────────────

export interface TiledMap {
  width:      number;   // nombre de tiles en X
  height:     number;   // nombre de tiles en Y
  tilewidth:  number;   // px par tile en source (32)
  tileheight: number;   // px par tile en source (32)
  layers:     TiledLayer[];
}

export type TiledLayer = TiledTileLayer | TiledObjectLayer;

export interface TiledTileLayer {
  id:   number;
  name: string;
  type: 'tilelayer';
  data: number[]; // tableau plat [width × height], 0 = vide
}

export interface TiledObjectLayer {
  id:      number;
  name:    string;
  type:    'objectgroup';
  objects: TiledObject[];
}

export interface TiledObject {
  id:          number;
  name:        string;
  x:           number;     // px depuis l'origine de la map
  y:           number;     // px depuis l'origine de la map
  width:       number;
  height:      number;
  properties?: TiledProperty[];
}

export interface TiledProperty {
  name:  string;
  type:  'string' | 'int' | 'float' | 'bool' | 'color';
  value: string | number | boolean;
}

// ── Parser ───────────────────────────────────────────────────

/**
 * Construit une grille de pathfinding (boolean[][]) depuis un JSON Tiled.
 * Recherche le calque nommé "Collisions" (insensible à la casse).
 * Tile > 0 = case bloquée. 0 = praticable.
 * Si le calque est absent, seuls les bords de la map sont bloqués.
 */
export function collisionGridFromTiled(map: TiledMap): Grid {
  const collisionLayer = map.layers.find(
    l => l.type === 'tilelayer' && l.name.toLowerCase() === 'collisions'
  ) as TiledTileLayer | undefined;

  return Array.from({ length: map.height }, (_, row) =>
    Array.from({ length: map.width }, (_, col) => {
      // Bords toujours bloqués
      if (row === 0 || row === map.height - 1) return false;
      if (col === 0 || col === map.width - 1)  return false;
      if (!collisionLayer) return true;
      const idx = row * map.width + col;
      return collisionLayer.data[idx] === 0; // 0 = pas de tile = praticable
    })
  );
}

/**
 * Retourne les objets du calque nommé `layerName` (objectgroup).
 */
export function objectsFromTiled(map: TiledMap, layerName: string): TiledObject[] {
  const layer = map.layers.find(
    l => l.type === 'objectgroup' && l.name === layerName
  ) as TiledObjectLayer | undefined;
  return layer?.objects ?? [];
}

/**
 * Lire une propriété Tiled par nom depuis un objet.
 */
export function getTiledProp(obj: TiledObject, name: string): string | number | boolean | undefined {
  return obj.properties?.find(p => p.name === name)?.value;
}

/**
 * Convertit des coordonnées pixel Tiled → cellule grille.
 */
export function tiledPxToCell(px: number, py: number, tileSize: number) {
  return {
    col: Math.floor(px / tileSize),
    row: Math.floor(py / tileSize),
  };
}
