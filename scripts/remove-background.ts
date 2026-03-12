/**
 * Supprime le fond blanc des images Bûcheron (frêne)
 * et sauvegarde en PNG transparent au même emplacement.
 *
 * Usage : npx ts-node --project tsconfig.hardhat.json scripts/remove-background.ts
 */

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

const IMAGES = [
  'public/assets/metiers/bucheron/frene/arbre.jpg',
  'public/assets/metiers/bucheron/frene/tronc_coupe.jpg',
  'public/assets/metiers/bucheron/frene/inventaire.jpg',
];

// Tolérance : 0 = blanc pur uniquement, 80 = blanc + légère teinte
const TOLERANCE = 80;

async function removeWhiteBackground(inputPath: string): Promise<void> {
  const outputPath = inputPath.replace(/\.jpg$/, '.png');

  const image = sharp(inputPath);
  const { width, height } = await image.metadata();

  if (!width || !height) throw new Error(`Impossible de lire les dimensions de ${inputPath}`);

  // Convertit en RGBA raw pour manipuler pixel par pixel
  const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Si le pixel est proche du blanc → transparent
    if (r >= 255 - TOLERANCE && g >= 255 - TOLERANCE && b >= 255 - TOLERANCE) {
      pixels[i + 3] = 0; // alpha = 0
    }
  }

  await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
}

async function main(): Promise<void> {
  console.log('\n=== Remove White Background ===\n');
  const root = path.join(__dirname, '..');

  for (const relPath of IMAGES) {
    const absPath = path.join(root, relPath);

    if (!fs.existsSync(absPath)) {
      console.warn(`  ⚠ Fichier introuvable : ${relPath}`);
      continue;
    }

    await removeWhiteBackground(absPath);
  }

  console.log('\nDone. Les fichiers .png sont dans le même dossier que les .jpg originaux.\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
