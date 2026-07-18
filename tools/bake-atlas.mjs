#!/usr/bin/env node
// Orchestrates the art/atlas bake: parses tile_list_v1.7.txt, generates the gap-fill sprites
// documented in assets/INVENTORY.md's GAPS section, and writes atlas.png/atlas.json/
// animations.json/contact-sheet.png + the font into packages/client/public/assets.
// Deterministic and idempotent: no randomness, no clock — same inputs, byte-identical outputs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Canvas } from './lib/png-canvas.mjs';
import { parseFrameList, groupFrames } from './lib/parse-frames.mjs';
import { buildPalette } from './lib/palette.mjs';
import { packAtlas, buildAtlasJson } from './lib/atlas-pack.mjs';
import { buildAnimations } from './lib/animations-build.mjs';
import { buildContactSheet } from './lib/contact-sheet.mjs';
import { generateItemIcons } from './lib/sprites/items.mjs';
import { generateFloorAndCrafting } from './lib/sprites/floor-crafting.mjs';
import { generateMonsterRecolors } from './lib/sprites/monster-recolors.mjs';
import { generateVfx } from './lib/sprites/vfx.mjs';

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const DUNGEON_DIR = path.join(REPO_ROOT, 'assets', 'dungeon');
const FONT_SRC = path.join(REPO_ROOT, 'assets', 'fonts', 'monogram.ttf');
const OUT_DIR = path.join(REPO_ROOT, 'packages', 'client', 'public', 'assets');
const OUT_FONTS_DIR = path.join(OUT_DIR, 'fonts');

// A few original frames shown alongside the generated sprites on the contact sheet, for
// eyeballing that the generated palette/outline style genuinely matches the source pack.
const COMPARISON_FRAMES = [
  'floor_1', 'crate', 'skull', 'goblin_idle_anim_f0',
  'swampy_anim_f0', 'muddy_anim_f0', 'wall_banner_red', 'chest_full_open_anim_f0',
];

function loadSourceFrames() {
  const text = fs.readFileSync(path.join(DUNGEON_DIR, 'tile_list_v1.7.txt'), 'utf8');
  const frames = parseFrameList(text);
  const frameByName = new Map(frames.map((f) => [f.name, f]));
  return { frames, frameByName };
}

function generateGapFillSprites(sheet, palette, frameByName) {
  return [
    ...generateItemIcons(palette),
    ...generateFloorAndCrafting(sheet, palette),
    ...generateMonsterRecolors(sheet, palette, frameByName),
    ...generateVfx(),
  ];
}

function buildComparisonSprites(sheet, frameByName) {
  return COMPARISON_FRAMES.map((name) => {
    const rect = frameByName.get(name);
    return { name, canvas: Canvas.fromRegion(sheet, rect.x, rect.y, rect.w, rect.h) };
  });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function copyFont() {
  fs.mkdirSync(OUT_FONTS_DIR, { recursive: true });
  fs.copyFileSync(FONT_SRC, path.join(OUT_FONTS_DIR, 'monogram.ttf'));
}

function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sheet = Canvas.fromFile(path.join(DUNGEON_DIR, '0x72_DungeonTilesetII_v1.7.png'));
  const { frames: originalFrames, frameByName } = loadSourceFrames();
  const palette = buildPalette(sheet);

  const gapFillSprites = generateGapFillSprites(sheet, palette, frameByName);
  const { atlas, generatedFrames } = packAtlas(sheet, gapFillSprites);
  const allFrames = [...originalFrames, ...generatedFrames];
  const groups = groupFrames(allFrames);

  atlas.writeFile(path.join(OUT_DIR, 'atlas.png'));
  writeJson(path.join(OUT_DIR, 'atlas.json'), buildAtlasJson(allFrames, atlas, 'atlas.png'));
  writeJson(path.join(OUT_DIR, 'animations.json'), buildAnimations(groups));
  copyFont();

  const comparisonSprites = buildComparisonSprites(sheet, frameByName);
  const contactSheet = buildContactSheet(gapFillSprites, comparisonSprites);
  contactSheet.writeFile(path.join(OUT_DIR, 'contact-sheet.png'));

  console.log(`Parsed ${originalFrames.length} original frames, ${groups.size} animation groups.`);
  console.log(`Generated ${gapFillSprites.length} gap-fill sprites.`);
  console.log(`Atlas: ${atlas.width}x${atlas.height} -> ${path.join(OUT_DIR, 'atlas.png')}`);
  console.log('Wrote atlas.json, animations.json, contact-sheet.png, fonts/monogram.ttf');
}

run();
