/** Cached 32x32 4-directional procedural character sprite builder with 64-entry LRU cache. */
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline } from "../textures/pixelCanvas.js";
import { buildArmorRects } from "./characterArmorLayers.js";
import { buildBodyRects } from "./characterBodyLayers.js";
import { buildHairRects } from "./characterHairLayers.js";
import {
  FRAME_SIZE, OUTLINE_RGB,
  type CharacterPose, type CharacterSpriteSet, type DirectionAnim, type FacingDir,
} from "./characterTypes.js";

export type { CharacterAnimState, CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
export { CHARACTER_WORLD_SCALE, resolveFacingDir } from "./characterTypes.js";

const MAX_CACHED_SETS = 64;

const IDLE_POSES: readonly CharacterPose[] = [
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: 1, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 1, shadowShrink: 0 },
  { bobY: 0, hairBobY: 1, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
];

const RUN_POSES: readonly CharacterPose[] = [
  { bobY: -1, hairBobY: 0, stride: 3, liftL: 2, liftR: 0, armSwing: 2, shadowShrink: 1 },
  { bobY: -1, hairBobY: -1, stride: 2, liftL: 1, liftR: 0, armSwing: 1, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: -1, hairBobY: 0, stride: -3, liftL: 0, liftR: 2, armSwing: -2, shadowShrink: 1 },
  { bobY: -1, hairBobY: -1, stride: -2, liftL: 0, liftR: 1, armSwing: -1, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
];

const spriteCache = new Map<string, CharacterSpriteSet>();

export function characterCacheKey(appearance: CharacterAppearance, armor: ArmorEquipment): string {
  return [
    appearance.body, appearance.skin, appearance.hairStyle, appearance.hairColor,
    armor.head ?? "-", armor.chest ?? "-", armor.legs ?? "-", armor.feet ?? "-",
  ].join("|");
}

function drawContactShadow(ctx: CanvasRenderingContext2D, shadowShrink: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "rgba(12, 16, 24, 0.34)";
  ctx.beginPath();
  ctx.ellipse(16, 29, 8 - shadowShrink, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(12, 16, 24, 0.2)";
  ctx.beginPath();
  ctx.ellipse(16, 29, 6 - shadowShrink, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderPoseFrame(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
}): { readonly canvas: HTMLCanvasElement; readonly texture: DirectionAnim["idle"][number] } {
  const { canvas, ctx } = createPixelCanvas(FRAME_SIZE.w, FRAME_SIZE.h);
  const { appearance, armor, dir, pose } = input;
  const rects = [
    ...buildBodyRects({ appearance, dir, pose }),
    ...buildArmorRects({ appearance, armor, dir, pose }),
    ...buildHairRects({ appearance, dir, pose, hooded: Boolean(armor.head) }),
  ];
  drawRects(ctx, rects);
  stampDarkOutline(ctx, FRAME_SIZE, OUTLINE_RGB);
  drawContactShadow(ctx, pose.shadowShrink);
  return { canvas, texture: canvasToNearestTexture(canvas) };
}

function buildDirectionAnim(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
}): { readonly anim: DirectionAnim; readonly previewUrl?: string } {
  const idleFrames = IDLE_POSES.map((pose) => renderPoseFrame({ ...input, pose }));
  const runFrames = RUN_POSES.map((pose) => renderPoseFrame({ ...input, pose }));
  const anim: DirectionAnim = {
    idle: idleFrames.map((f) => f.texture),
    run: runFrames.map((f) => f.texture),
  };
  const firstCanvas = idleFrames[0]?.canvas;
  return firstCanvas ? { anim, previewUrl: firstCanvas.toDataURL() } : { anim };
}

function destroySpriteSet(set: CharacterSpriteSet | undefined): void {
  if (!set) return;
  for (const dirAnim of [set.south, set.north, set.side]) {
    const all = [...dirAnim.idle, ...dirAnim.run, ...(dirAnim.jump ?? []), ...(dirAnim.fall ?? [])];
    for (const tex of all) tex.destroy(true);
  }
}

function evictOldestIfFull(): void {
  if (spriteCache.size < MAX_CACHED_SETS) return;
  const oldestKey = spriteCache.keys().next().value;
  if (!oldestKey) return;
  const evicted = spriteCache.get(oldestKey);
  spriteCache.delete(oldestKey);
  destroySpriteSet(evicted);
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
  const southBuilt = buildDirectionAnim({ appearance, armor, dir: "south" });
  const northBuilt = buildDirectionAnim({ appearance, armor, dir: "north" });
  const sideBuilt = buildDirectionAnim({ appearance, armor, dir: "side" });
  const created: CharacterSpriteSet = {
    south: southBuilt.anim,
    north: northBuilt.anim,
    side: sideBuilt.anim,
    previewUrl: southBuilt.previewUrl ?? "",
  };
  spriteCache.set(key, created);
  return created;
}
