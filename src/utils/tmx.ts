// ============================================================
// Parser pour maps Tiled TMX (XML)
// Gère les tilesets externes (.tsx) + calques tile + calques objets
// ============================================================

import { Grid } from './grid';

// ── Types ────────────────────────────────────────────────────

export interface TmxParsed {
  width:      number;
  height:     number;
  tilewidth:  number;
  tileheight: number;
  tileLayers:   TmxTileLayer[];
  objectLayers: TmxObjectLayer[];
}

export interface TmxTileLayer {
  id:   number;
  name: string;
  data: number[]; // flat array [width × height], 0 = vide
}

export interface TmxObjectLayer {
  id:      number;
  name:    string;
  objects: TmxRect[];
}

export interface TmxRect {
  id:     number;
  name:   string;
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface TmxTilesetDef {
  firstgid:   number;
  name:       string;
  tilewidth:  number;
  tileheight: number;
  columns:    number;
  imageFile:  string; // nom du fichier PNG (sans chemin)
}

// ── Parser TMX XML ───────────────────────────────────────────

export function parseTmx(xml: string): TmxParsed {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const map = doc.querySelector('map')!;

  const width      = parseInt(map.getAttribute('width')!);
  const height     = parseInt(map.getAttribute('height')!);
  const tilewidth  = parseInt(map.getAttribute('tilewidth')!);
  const tileheight = parseInt(map.getAttribute('tileheight')!);

  const tileLayers: TmxTileLayer[] = [];
  for (const layer of Array.from(doc.querySelectorAll('map > layer'))) {
    const id   = parseInt(layer.getAttribute('id')!);
    const name = layer.getAttribute('name') ?? '';
    const dataEl   = layer.querySelector('data');
    if (!dataEl) continue;
    const encoding = dataEl.getAttribute('encoding');
    let data: number[] = [];
    if (encoding === 'csv') {
      data = dataEl.textContent!.trim().split(',').map(s => parseInt(s.trim(), 10));
    }
    tileLayers.push({ id, name, data });
  }

  const objectLayers: TmxObjectLayer[] = [];
  for (const og of Array.from(doc.querySelectorAll('map > objectgroup'))) {
    const id   = parseInt(og.getAttribute('id')!);
    const name = og.getAttribute('name') ?? '';
    const objects: TmxRect[] = [];
    for (const obj of Array.from(og.querySelectorAll('object'))) {
      objects.push({
        id:     parseInt(obj.getAttribute('id') ?? '0'),
        name:   obj.getAttribute('name') ?? '',
        x:      parseFloat(obj.getAttribute('x') ?? '0'),
        y:      parseFloat(obj.getAttribute('y') ?? '0'),
        width:  parseFloat(obj.getAttribute('width') ?? '0'),
        height: parseFloat(obj.getAttribute('height') ?? '0'),
      });
    }
    objectLayers.push({ id, name, objects });
  }

  return { width, height, tilewidth, tileheight, tileLayers, objectLayers };
}

// ── Grille pathfinding depuis calque objets ──────────────────

/**
 * Construit une Grid depuis un calque "collisions" (objectgroup de rectangles en px).
 * Les rectangles sans dimensions (points) sont ignorés.
 */
export function collisionGridFromObjects(
  objects: TmxRect[],
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
): Grid {
  const grid: Grid = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(true));

  // Bords toujours bloqués
  for (let c = 0; c < mapWidth; c++) {
    grid[0][c] = false;
    grid[mapHeight - 1][c] = false;
  }
  for (let r = 0; r < mapHeight; r++) {
    grid[r][0] = false;
    grid[r][mapWidth - 1] = false;
  }

  // Rectangles de collision → cases bloquées
  for (const obj of objects) {
    if (!obj.width || !obj.height) continue;
    const col0 = Math.floor(obj.x / tileSize);
    const row0 = Math.floor(obj.y / tileSize);
    const col1 = Math.ceil((obj.x + obj.width) / tileSize);
    const row1 = Math.ceil((obj.y + obj.height) / tileSize);
    for (let r = row0; r < row1; r++) {
      for (let c = col0; c < col1; c++) {
        if (r >= 0 && r < mapHeight && c >= 0 && c < mapWidth) {
          grid[r][c] = false;
        }
      }
    }
  }

  return grid;
}
