/** Cached procedural character sprite-sheet builder with bounded 64-entry LRU eviction. */
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline } from "../textures/pixelCanvas.js";
import { buildCharacterFrameRects, type CharacterPose } from "./characterLayers.js";

export interface CharacterSpriteSet {
  readonly idle: readonly Texture[];
  readonly run: readonly Texture[];
  readonly previewUrl: string;
}

const FRAME_SIZE = { w: 20, h: 26 } as const;
const OUTLINE_RGB = [20, 16, 24] as const;
const MAX_CACHED_SETS = 64;

const IDLE_POSES: readonly CharacterPose[] = [
  { bobY: 0, leftLegDy: 0, rightLegDy: 0, armSwing: 0 },
  { bobY: 0, leftLegDy: 0, rightLegDy: 0, armSwing: 0 },
  { bobY: 1, leftLegDy: 0, rightLegDy: 0, armSwing: 0 },
  { bobY: 0, leftLegDy: 0, rightLegDy: 0, armSwing: 0 },
];

const RUN_POSES: readonly CharacterPose[] = [
  { bobY: -1, leftLegDy: -1, rightLegDy: 0, armSwing: 1 },
  { bobY: 0, leftLegDy: 0, rightLegDy: 0, armSwing: 0 },
  { bobY: -1, leftLegDy: 0, rightLegDy: -1, armSwing: -1 },
  { bobY: 0, leftLegDy: 0, rightLegDy: 0, armSwing: 0 },
];

const spriteCache = new Map<string, CharacterSpriteSet>();

export function characterCacheKey(appearance: CharacterAppearance, armor: ArmorEquipment): string {
  return [
    appearance.body, appearance.skin, appearance.hairStyle, appearance.hairColor,
    armor.head ?? "-", armor.chest ?? "-", armor.legs ?? "-", armor.feet ?? "-",
  ].join("|");
}

function renderPoseFrame(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly pose: CharacterPose;
}): { readonly canvas: HTMLCanvasElement; readonly texture: Texture } {
  const { canvas, ctx } = createPixelCanvas(FRAME_SIZE.w, FRAME_SIZE.h);
  drawRects(ctx, buildCharacterFrameRects(input));
  stampDarkOutline(ctx, FRAME_SIZE, OUTLINE_RGB);
  return { canvas, texture: canvasToNearestTexture(canvas) };
}

function evictOldestIfFull(): void {
  if (spriteCache.size < MAX_CACHED_SETS) return;
  const oldestKey = spriteCache.keys().next().value;
  if (!oldestKey) return;
  const evicted = spriteCache.get(oldestKey);
  spriteCache.delete(oldestKey);
  if (!evicted) return;
  for (const tex of evicted.idle) tex.destroy(true);
  for (const tex of evicted.run) tex.destroy(true);
}

export function getCharacterSpriteSet(appearance: CharacterAppearance, armor: ArmorEquipment): CharacterSpriteSet {
  const key = characterCacheKey(appearance, armor);
  const existing = spriteCache.get(key);
  if (existing) {
    spriteCache.delete(key);
    spriteCache.set(key, existing);
    return existing;
  }
  evictOldestIfFull();
  const idleRendered = IDLE_POSES.map((pose) => renderPoseFrame({ appearance, armor, pose }));
  const runRendered = RUN_POSES.map((pose) => renderPoseFrame({ appearance, armor, pose }));
  const created: CharacterSpriteSet = {
    idle: idleRendered.map((f) => f.texture),
    run: runRendered.map((f) => f.texture),
    previewUrl: idleRendered[0]?.canvas.toDataURL() ?? "",
  };
  spriteCache.set(key, created);
  return created;
}
