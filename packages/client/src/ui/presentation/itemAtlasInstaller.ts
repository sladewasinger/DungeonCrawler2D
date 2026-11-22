/** Expands the runtime Phaser atlas with pixel-art frames for new forest items, armor, and mobs. */
import type Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";
import { drawOutlinedPixelRects } from "./atlas/pixelOutline.js";
import { PROCEDURAL_ENEMY_SPECS, type ProceduralEnemySpriteSpec } from "./enemyAtlasShapes.js";
import { ITEM_ICON_SHAPES, type PixelRect } from "./itemIconShapes.js";

export const PROCEDURAL_ITEM_FRAMES: Readonly<Record<string, string>> = {
  bandage: "item_bandage",
  rag: "item_rag",
  "raw-meat": "item_raw_meat",
  stick: "item_stick",
  torch: "item_torch",
  "cooked-meat": "item_cooked_meat",
  herb: "item_herb",
  flint: "item_flint",
  "spider-silk": "item_spider_silk",
  "wolf-pelt": "item_wolf_pelt",
  "bear-hide": "item_bear_hide",
  "leather-hood": "item_leather_hood",
  "leather-tunic": "item_leather_tunic",
  "leather-leggings": "item_leather_leggings",
  "leather-boots": "item_leather_boots",
  "grizzly-helm": "item_grizzly_helm",
  "grizzly-cuirass": "item_grizzly_cuirass",
  "grizzly-greaves": "item_grizzly_greaves",
  "grizzly-boots": "item_grizzly_boots",
};

interface FrameCoord {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function installProceduralItemAtlasFrames(
  textures: Phaser.Textures.TextureManager,
): void {
  if (typeof document === "undefined" || !textures.exists(ASSET_KEYS.atlas)) return;
  const existing = textures.get(ASSET_KEYS.atlas);
  if (existing.has("item_flint")) return;
  const sourceImage = existing.getSourceImage() as HTMLImageElement | HTMLCanvasElement | null;
  if (!sourceImage || !("width" in sourceImage)) return;
  rebuildAtlasWithItems(textures, existing, sourceImage);
}

export function registerProceduralEnemyAnimations(
  anims: Phaser.Animations.AnimationManager,
): void {
  for (const spec of PROCEDURAL_ENEMY_SPECS) {
    ensureEnemyAnimation(anims, spec.prefix, "idle");
    ensureEnemyAnimation(anims, spec.prefix, "run");
  }
}

function ensureEnemyAnimation(
  anims: Phaser.Animations.AnimationManager,
  prefix: string,
  kind: "idle" | "run",
): void {
  const key = `${prefix}_${kind}`;
  if (anims.exists(key)) return;
  anims.create({
    key,
    frames: [0, 1, 2, 3].map((i) => ({ key: ASSET_KEYS.atlas, frame: `${prefix}_${kind}_f${i}` })),
    frameRate: kind === "idle" ? 6 : 10,
    repeat: -1,
  });
}

function rebuildAtlasWithItems(
  textures: Phaser.Textures.TextureManager,
  existing: Phaser.Textures.Texture,
  sourceImage: HTMLImageElement | HTMLCanvasElement,
): void {
  const extraY = sourceImage.height + 2;
  const itemRows = Math.ceil(Object.keys(PROCEDURAL_ITEM_FRAMES).length / 28);
  const enemyStartY = extraY + itemRows * 18 + 8;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(512, sourceImage.width);
  canvas.height = enemyStartY + 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(sourceImage, 0, 0);
  const itemFrames = stampProceduralItems(ctx, extraY);
  const enemyFrames = stampProceduralEnemies(ctx, enemyStartY);
  const replaced = new Set(Object.values(PROCEDURAL_ITEM_FRAMES));
  const savedFrames = collectExistingFrames(existing).filter((frame) => !replaced.has(frame.name));
  textures.remove(ASSET_KEYS.atlas);
  const updated = textures.addCanvas(ASSET_KEYS.atlas, canvas);
  if (!updated) return;
  for (const frame of [...savedFrames, ...itemFrames, ...enemyFrames]) {
    updated.add(frame.name, 0, frame.x, frame.y, frame.w, frame.h);
  }
}

function stampProceduralItems(ctx: CanvasRenderingContext2D, extraY: number): FrameCoord[] {
  return Object.entries(PROCEDURAL_ITEM_FRAMES).map(([itemId, name], index) => {
    const x = (index % 28) * 17;
    const y = extraY + Math.floor(index / 28) * 17;
    drawPixelRects(ctx, { ox: x, oy: y, rects: ITEM_ICON_SHAPES[itemId] ?? [] });
    return { name, x, y, w: 16, h: 16 };
  });
}

function stampProceduralEnemies(ctx: CanvasRenderingContext2D, startY: number): FrameCoord[] {
  const out: FrameCoord[] = [];
  let cursorY = startY;
  for (const spec of PROCEDURAL_ENEMY_SPECS) {
    out.push(...stampEnemySpec(ctx, spec, cursorY));
    cursorY += spec.height + 2;
  }
  return out;
}

function stampEnemySpec(
  ctx: CanvasRenderingContext2D,
  spec: ProceduralEnemySpriteSpec,
  cursorY: number,
): FrameCoord[] {
  const out: FrameCoord[] = [];
  let col = 0;
  for (const anim of ["idle", "run"] as const) {
    for (let f = 0; f < 4; f++) {
      const x = col * (spec.width + 2);
      drawOutlinedPixelRects(ctx, {
        ox: x, oy: cursorY, width: spec.width, height: spec.height,
        rects: spec.frameRects(anim, f),
      });
      out.push({ name: `${spec.prefix}_${anim}_f${f}`, x, y: cursorY, w: spec.width, h: spec.height });
      col++;
    }
  }
  return out;
}

function drawPixelRects(
  ctx: CanvasRenderingContext2D,
  input: { ox: number; oy: number; rects: readonly PixelRect[] },
): void {
  for (const [x, y, w, h, color] of input.rects) {
    ctx.fillStyle = color;
    ctx.fillRect(input.ox + x, input.oy + y, w, h);
  }
}

function collectExistingFrames(texture: Phaser.Textures.Texture): FrameCoord[] {
  const out: FrameCoord[] = [];
  for (const name of texture.getFrameNames()) {
    const frame = texture.get(name);
    if (!frame) continue;
    out.push({ name, x: frame.cutX, y: frame.cutY, w: frame.cutWidth, h: frame.cutHeight });
  }
  return out;
}
