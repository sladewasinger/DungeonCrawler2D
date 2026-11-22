/** Cached 32x32 4-directional procedural character sprite builder with 64-entry LRU cache. */
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline } from "../textures/pixelCanvas.js";
import { armCanvasSize, buildArmRects } from "./armRig.js";
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
  readonly includeArms?: boolean | undefined;
}): { readonly canvas: HTMLCanvasElement; readonly texture: DirectionAnim["idle"][number] } {
  const { canvas, ctx } = createPixelCanvas(FRAME_SIZE.w, FRAME_SIZE.h);
  const { appearance, armor, dir, pose, includeArms } = input;
  const rects = [
    ...buildBodyRects({ appearance, dir, pose, includeArms }),
    ...buildArmorRects({ appearance, armor, dir, pose, includeArms }),
    ...buildHairRects({ appearance, dir, pose, hooded: Boolean(armor.head) }),
  ];
  drawRects(ctx, rects);
  stampDarkOutline(ctx, FRAME_SIZE, OUTLINE_RGB);
  return { canvas, texture: canvasToNearestTexture(canvas) };
}

function buildArmTexture(appearance: CharacterAppearance, armor: ArmorEquipment, shaded: boolean): Texture {
  const size = armCanvasSize(appearance.body === "female");
  const { canvas, ctx } = createPixelCanvas(size.w, size.h);
  drawRects(ctx, buildArmRects({ appearance, armor, shaded }));
  stampDarkOutline(ctx, size, OUTLINE_RGB);
  return canvasToNearestTexture(canvas);
}

function buildDirectionAnim(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
}): DirectionAnim {
  return {
    idle: IDLE_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
    run: RUN_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
    jump: JUMP_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
    fall: FALL_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
  };
}

function destroySpriteSet(set: CharacterSpriteSet | undefined): void {
  if (!set) return;
  for (const dirAnim of [set.south, set.north, set.side]) {
    for (const tex of [...dirAnim.idle, ...dirAnim.run, ...dirAnim.jump, ...dirAnim.fall]) {
      tex.destroy(true);
    }
  }
  set.frontArm.destroy(true);
  set.backArm.destroy(true);
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
  const previewFrame = renderPoseFrame({ appearance, armor, dir: "south", pose: IDLE_POSES[0]!, includeArms: true });
  const created: CharacterSpriteSet = {
    south: buildDirectionAnim({ appearance, armor, dir: "south" }),
    north: buildDirectionAnim({ appearance, armor, dir: "north" }),
    side: buildDirectionAnim({ appearance, armor, dir: "side" }),
    frontArm: buildArmTexture(appearance, armor, false),
    backArm: buildArmTexture(appearance, armor, true),
    previewUrl: previewFrame.canvas.toDataURL(),
  };
  previewFrame.texture.destroy(true);
  spriteCache.set(key, created);
  return created;
}
