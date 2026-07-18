// Composes the final atlas: the original sheet copied verbatim at (0,0) — so every original
// frame's x/y/w/h from tile_list_v1.7.txt stays valid unchanged — plus generated sprites
// shelf-packed into the extended region below. Also emits the Phaser 3 atlas JSON (hash format).
import { Canvas } from './png-canvas.mjs';

const PADDING = 1;

function shelfPack(sprites, atlasWidth) {
  const sorted = [...sprites].sort((a, b) => b.canvas.height - a.canvas.height);
  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;
  const placements = [];
  for (const sprite of sorted) {
    const { width: w, height: h } = sprite.canvas;
    if (shelfX + w > atlasWidth) {
      shelfX = 0;
      shelfY += shelfHeight + PADDING;
      shelfHeight = 0;
    }
    placements.push({ ...sprite, x: shelfX, y: shelfY, w, h });
    shelfX += w + PADDING;
    shelfHeight = Math.max(shelfHeight, h);
  }
  return { placements, packedHeight: shelfY + shelfHeight };
}

export function packAtlas(sheet, generatedSprites) {
  const { placements, packedHeight } = shelfPack(generatedSprites, sheet.width);
  const atlasHeight = sheet.height + PADDING + packedHeight;
  const atlas = new Canvas(sheet.width, atlasHeight);
  atlas.blit(sheet, 0, 0, 0, 0, sheet.width, sheet.height);
  const generatedFrames = [];
  for (const placement of placements) {
    const destY = sheet.height + PADDING + placement.y;
    atlas.blit(placement.canvas, 0, 0, placement.x, destY, placement.w, placement.h);
    generatedFrames.push({ name: placement.name, x: placement.x, y: destY, w: placement.w, h: placement.h });
  }
  return { atlas, generatedFrames };
}

/** Phaser 3 texture-atlas JSON, hash format (TexturePacker-compatible). */
export function buildAtlasJson(allFrames, atlas, imageName) {
  const frames = {};
  for (const f of allFrames) {
    frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  }
  return {
    frames,
    meta: {
      app: 'dc2d-bake-atlas',
      version: '1.0',
      image: imageName,
      format: 'RGBA8888',
      size: { w: atlas.width, h: atlas.height },
      scale: '1',
    },
  };
}
