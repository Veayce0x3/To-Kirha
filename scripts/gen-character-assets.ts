/**
 * Génère les PNG placeholders pour le personnage jouable.
 * Usage : npm run gen:assets
 */

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

const W = 32;
const H = 64;
const ROOT = path.join(process.cwd(), 'public/assets/personnage');

type RGBA = [number, number, number, number];

async function createPng(filePath: string, color: RGBA): Promise<void> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4]     = color[0];
    buf[i * 4 + 1] = color[1];
    buf[i * 4 + 2] = color[2];
    buf[i * 4 + 3] = color[3];
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
  console.log('  ✓', path.relative(process.cwd(), filePath));
}

const DIRS: { name: string; color: RGBA }[] = [
  { name: 'face',   color: [107, 191,  68, 255] }, // vert clair  #6abf44
  { name: 'dos',    color: [ 46, 125,  50, 255] }, // vert foncé  #2e7d32
  { name: 'gauche', color: [129, 199, 132, 255] }, // vert pastel #81c784
  { name: 'droite', color: [ 56, 142,  60, 255] }, // vert moyen  #388e3c
];

async function main(): Promise<void> {
  console.log('\n=== Gen Character Placeholder Assets ===\n');

  // ── Base sprites ────────────────────────────────────────────
  for (const d of DIRS) {
    await createPng(path.join(ROOT, `base/${d.name}.png`), d.color);
  }

  // ── Marche — 4 frames par direction (alpha légèrement variable) ──
  for (const d of DIRS) {
    for (let f = 1; f <= 4; f++) {
      const a = 180 + f * 18;
      await createPng(
        path.join(ROOT, `marche/${d.name}/frame${f}.png`),
        [d.color[0], d.color[1], d.color[2], Math.min(255, a)],
      );
    }
  }

  // ── Récolte — 3 frames (orange) ─────────────────────────────
  const RECOLTE: RGBA = [255, 152, 0, 255]; // #ff9800
  for (let f = 1; f <= 3; f++) {
    await createPng(path.join(ROOT, `recolte/frame${f}.png`), RECOLTE);
  }

  // ── Dossiers vêtements (juste .gitkeep, sprites à venir) ────
  for (const slot of ['haut', 'bas', 'chaussures', 'chapeau', 'accessoires']) {
    const dir = path.join(ROOT, `vetements/${slot}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    console.log(`  ✓ vetements/${slot}/.gitkeep`);
  }

  console.log('\nDone — tous les assets placeholders sont générés.\n');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
