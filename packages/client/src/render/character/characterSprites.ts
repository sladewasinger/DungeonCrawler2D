/** Cached 32x32 4-directional procedural character sprite builder with 64-entry LRU cache. */
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline } from "../textures/pixelCanvas.js";
import { buildArmorRects } from "./characterArmorLayers.js";
import { buildBodyRects } from "./characterBodyLayers.js";
import { buildHairRects } from "./characterHairLayers.js";
import {
  FALL_POSES, FRAME_SIZE, IDLE_POSES, JUMP_POSES, OUTLINE_RGB, RUN_POSES,
  type CharacterPose, type CharacterSpriteSet, type DirectionAnim, type FacingDir,
} from "./characterTypes.js";

export type { CharacterAnimState, CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
export { CHARACTER_WORLD_SCALE, resolveFacingDir } from "./characterTypes.js";

const MAX_CACHED_SETS = 64;
const spriteCache = new Map<string, CharacterSpriteSet>();

export function characterCacheKey(appearance: CharacterAppearance, armor: ArmorEquipment): string {
  return [
    appearance.body, appearance.skin, appearance.eyeColor, appearance.hairStyle, appearance.hairColor,
    armor.head ?? "-", armor.chest ?? "-", armor.legs ?? "-", armor.feet ?? "-",
  ].join("|");
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
  return { canvas, texture: canvasToNearestTexture(canvas) };
}

function buildDirectionAnim(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
}): { readonly anim: DirectionAnim; readonly previewUrl?: string } {
  const idleFrames = IDLE_POSES.map((pose) => renderPoseFrame({ ...input, pose }));
  const runFrames = RUN_POSES.map((pose) => renderPoseFrame({ ...input, pose }));
  const jumpFrames = JUMP_POSES.map((pose) => renderPoseFrame({ ...input, pose }));
  const fallFrames = FALL_POSES.map((pose) => renderPoseFrame({ ...input, pose }));
  const anim: DirectionAnim = {
    idle: idleFrames.map((f) => f.texture),
    run: runFrames.map((f) => f.texture),
    jump: jumpFrames.map((f) => f.texture),
    fall: fallFrames.map((f) => f.texture),
  };
  const firstCanvas = idleFrames[0]?.canvas;
  return firstCanvas ? { anim, previewUrl: firstCanvas.toDataURL() } : { anim };
}

function destroySpriteSet(set: CharacterSpriteSet | undefined): void {
  if (!set) return;
  for (const dirAnim of [set.south, set.north, set.side]) {
    for (const tex of [...dirAnim.idle, ...dirAnim.run, ...dirAnim.jump, ...dirAnim.fall]) {
      tex.destroy(true);
    }
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
