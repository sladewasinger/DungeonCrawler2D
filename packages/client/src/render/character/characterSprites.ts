/** Cached 32x32 4-directional procedural character sprite builder with 64-entry LRU cache. */
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline } from "../textures/pixelCanvas.js";
import { armCanvasSize, buildArmRects } from "./armRig.js";
import { buildArmorRects } from "./characterArmorLayers.js";
import { buildBodyRects } from "./characterBodyLayers.js";
import { buildHairRects } from "./characterHairLayers.js";
import {
  FALL_POSES, FRAME_SIZE, IDLE_POSES, JUMP_POSES, OUTLINE_RGB, RUN_POSES, WALK_POSES,
  type CharacterPose, type CharacterSpriteSet, type DirectionAnim, type FacingDir,
} from "./characterTypes.js";
import { isPlayer3dReady } from "./playerAssets.js";
import { build3dCharacterPortraitUrl, build3dCharacterSpriteSet } from "./playerCompositor.js";

export type { CharacterAnimState, CharacterSpriteSet, DirectionAnim, FacingDir } from "./characterTypes.js";
export { CHARACTER_WORLD_SCALE, resolveFacingDir, resolveFacingDir8 } from "./characterTypes.js";

const MAX_CACHED_SETS = 64;
const MAX_CACHED_PORTRAITS = 256;
const spriteCache = new Map<string, CharacterSpriteSet>();
const portraitCache = new Map<string, string>();
let cacheRevision = 0;

export function getCharacterCacheRevision(): number {
  return cacheRevision;
}

export function invalidateCharacterCacheKey(key: string): void {
  const evicted = spriteCache.get(key);
  if (evicted) {
    spriteCache.delete(key);
    destroySpriteSet(evicted);
  }
  portraitCache.delete(key);
  cacheRevision += 1;
}

export function characterCacheKey(appearance: CharacterAppearance, armor: ArmorEquipment): string {
  return [
    appearance.body, appearance.skin, appearance.eyeColor, appearance.hairStyle, appearance.hairColor,
    armor.head ?? "-", armor.chest ?? "-", armor.legs ?? "-", armor.feet ?? "-",
  ].join("|");
}

function renderPoseCanvas(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
  readonly includeArms?: boolean | undefined;
}): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(FRAME_SIZE.w, FRAME_SIZE.h);
  const { appearance, armor, dir, pose, includeArms } = input;
  const rects = [
    ...buildBodyRects({ appearance, dir, pose, includeArms }),
    ...buildArmorRects({ appearance, armor, dir, pose, includeArms }),
    ...buildHairRects({ appearance, dir, pose, hooded: Boolean(armor.head) }),
  ];
  drawRects(ctx, rects);
  stampDarkOutline(ctx, FRAME_SIZE, OUTLINE_RGB);
  return canvas;
}

function renderPoseFrame(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
  readonly includeArms?: boolean | undefined;
}): { readonly canvas: HTMLCanvasElement; readonly texture: DirectionAnim["idle"][number] } {
  const canvas = renderPoseCanvas(input);
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
    walk: WALK_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
    run: RUN_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
    jump: JUMP_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
    fall: FALL_POSES.map((pose) => renderPoseFrame({ ...input, pose }).texture),
  };
}

function collectDirTextures(dirAnim: DirectionAnim | undefined, unique: Set<Texture>): void {
  if (!dirAnim) return;
  for (const track of Object.values(dirAnim) as readonly (readonly Texture[] | undefined)[]) {
    if (track) for (const tex of track) unique.add(tex);
  }
}

function destroySpriteSet(set: CharacterSpriteSet | undefined): void {
  if (!set) return;
  const unique = new Set<Texture>([set.frontArm, set.backArm]);
  for (const dirAnim of [set.south, set.se, set.north, set.ne, set.side]) collectDirTextures(dirAnim, unique);
  for (const tex of unique) if (tex !== Texture.EMPTY) tex.destroy(true);
}

function evictOldestIfFull(): void {
  if (spriteCache.size < MAX_CACHED_SETS) return;
  const oldestKey = spriteCache.keys().next().value;
  if (!oldestKey) return;
  const evicted = spriteCache.get(oldestKey);
  spriteCache.delete(oldestKey);
  destroySpriteSet(evicted);
}

function buildFallbackSpriteSet(appearance: CharacterAppearance, armor: ArmorEquipment): CharacterSpriteSet {
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
  return created;
}

function storePortraitLru(key: string, url: string): string {
  portraitCache.delete(key);
  portraitCache.set(key, url);
  while (portraitCache.size > MAX_CACHED_PORTRAITS) {
    const oldest = portraitCache.keys().next().value;
    if (oldest !== undefined) portraitCache.delete(oldest);
  }
  return url;
}

export function getCharacterPortraitUrl(appearance: CharacterAppearance, armor: ArmorEquipment): string {
  const key = characterCacheKey(appearance, armor);
  const cached = portraitCache.get(key);
  if (cached) return storePortraitLru(key, cached);
  const full = spriteCache.get(key);
  if (full) return storePortraitLru(key, full.previewUrl);
  const url = (isPlayer3dReady() ? build3dCharacterPortraitUrl(appearance, armor) : null)
    ?? renderPoseCanvas({ appearance, armor, dir: "south", pose: IDLE_POSES[0]!, includeArms: true }).toDataURL();
  return storePortraitLru(key, url);
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
  const created =
    (isPlayer3dReady() ? build3dCharacterSpriteSet(appearance, armor, () => invalidateCharacterCacheKey(key)) : null)
    ?? buildFallbackSpriteSet(appearance, armor);
  spriteCache.set(key, created);
  storePortraitLru(key, created.previewUrl);
  return created;
}
