// ============================================================
// TileMap — rendu canvas d'une map Tiled TMX
// Supporte tilesets 32×32 (sol) et 64×64 (décors).
// Les grands tiles sont alignés par le bas (comportement Tiled standard).
// ============================================================

import { useEffect, useRef } from 'react';
import { TmxParsed, TmxTilesetDef } from '../utils/tmx';

const BASE = import.meta.env.BASE_URL;

// ── Chargement image ─────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`TileMap: impossible de charger ${url}`));
    img.src = url;
  });
}

// ── Trouver le tileset d'un GID ──────────────────────────────

function findTileset(defs: TmxTilesetDef[], gid: number): TmxTilesetDef | null {
  let found: TmxTilesetDef | null = null;
  for (const ts of defs) {
    if (ts.firstgid <= gid && (!found || ts.firstgid > found.firstgid)) {
      found = ts;
    }
  }
  return found;
}

// ── Props ────────────────────────────────────────────────────

interface Props {
  tmx:        TmxParsed;
  tilesets:   TmxTilesetDef[];
  layerNames: string[];
  bgColor?:   string;
  style?:     React.CSSProperties;
}

// ── Composant ────────────────────────────────────────────────

export function TileMap({ tmx, tilesets, layerNames, bgColor = '#2d4a1e', style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mapW = tmx.width  * tmx.tilewidth;
  const mapH = tmx.height * tmx.tileheight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    async function render() {
      // Charger tous les tilesets
      const images = new Map<string, HTMLImageElement>();
      await Promise.all(
        tilesets.map(async ts => {
          const url = `${BASE}assets/tilesets/${ts.imageFile}`;
          try {
            images.set(ts.imageFile, await loadImage(url));
          } catch {
            console.warn(`TileMap: tileset manquant — ${ts.imageFile}`);
          }
        }),
      );

      if (cancelled || !canvas || !ctx) return;

      // Fond
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, mapW, mapH);

      // Rendu calque par calque
      for (const name of layerNames) {
        const layer = tmx.tileLayers.find(l => l.name === name);
        if (!layer) continue;

        for (let row = 0; row < tmx.height; row++) {
          for (let col = 0; col < tmx.width; col++) {
            const gid = layer.data[row * tmx.width + col];
            if (!gid) continue;

            const ts = findTileset(tilesets, gid);
            if (!ts) continue;

            const img = images.get(ts.imageFile);
            if (!img) continue;

            const localId = gid - ts.firstgid;
            const srcX = (localId % ts.columns) * ts.tilewidth;
            const srcY = Math.floor(localId / ts.columns) * ts.tileheight;

            const dstX = col * tmx.tilewidth;
            // Tiled aligne les grands tiles par le bas du cell
            const dstY = (row + 1) * tmx.tileheight - ts.tileheight;

            ctx.drawImage(
              img,
              srcX, srcY, ts.tilewidth, ts.tileheight,
              dstX, dstY, ts.tilewidth, ts.tileheight,
            );
          }
        }
      }
    }

    render();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmx, tilesets, layerNames, bgColor]);

  return (
    <canvas
      ref={canvasRef}
      width={mapW}
      height={mapH}
      style={{
        position:       'absolute',
        left:           0,
        top:            0,
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  );
}
