/** Resolves 4-directional spritesheet facing, state clip selection, and frame timing. */
import type { WorldEntitySnapshot } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import type {
  LoadedSpriteAnimations,
  LoadedSpriteClip,
  SpriteAnimState,
  SpriteDirection,
} from "../textures/spriteManifest.js";

const DIR_SOUTH: SpriteDirection = "south";
const DIR_SIDE: SpriteDirection = "side";
const DIR_NORTH: SpriteDirection = "north";

const STATE_IDLE: SpriteAnimState = "idle";
const STATE_WALK: SpriteAnimState = "walk";
const STATE_ATTACK: SpriteAnimState = "attack";
const STATE_CORPSE: SpriteAnimState = "corpse";

export interface SampledSpriteFrame {
  readonly texture: Texture;
  readonly flipX: 1 | -1;
}

export function resolveFacingDirection(facingX: number, facingY: number): {
  readonly dir: SpriteDirection;
  readonly flipX: 1 | -1;
} {
  if (Math.abs(facingX) >= Math.abs(facingY) * 0.85) {
    return { dir: DIR_SIDE, flipX: facingX < 0 ? -1 : 1 };
  }
  return { dir: facingY < 0 ? DIR_NORTH : DIR_SOUTH, flipX: 1 };
}

export function resolveAnimState(input: {
  readonly snap: WorldEntitySnapshot;
  readonly dead: boolean;
  readonly moving: boolean;
}): SpriteAnimState {
  if (input.dead) return STATE_CORPSE;
  if (input.snap.telegraphProgress > 0 || input.snap.aiState === "charge") return STATE_ATTACK;
  return input.moving ? STATE_WALK : STATE_IDLE;
}

function pickClipForState(
  anims: LoadedSpriteAnimations,
  state: SpriteAnimState,
  dir: SpriteDirection,
): LoadedSpriteClip | null {
  const byDir = anims.clips[state] ?? anims.clips[STATE_IDLE];
  if (!byDir) return null;
  return byDir[dir] ?? byDir[DIR_SIDE] ?? byDir[DIR_SOUTH] ?? byDir[DIR_NORTH] ?? null;
}

function resolveFrameIndex(input: {
  readonly state: SpriteAnimState;
  readonly snap: WorldEntitySnapshot;
  readonly clip: LoadedSpriteClip;
  readonly timeSec: number;
}): number {
  const len = input.clip.frames.length;
  if (len <= 1) return 0;
  if (input.state === STATE_ATTACK && input.snap.telegraphProgress > 0) {
    return input.snap.telegraphProgress < 0.62 ? 0 : Math.min(len - 1, 1);
  }
  const phase = Math.abs(input.snap.x * 0.37 + input.snap.y * 0.19);
  return Math.floor(Math.max(0, input.timeSec) * input.clip.fps + phase) % len;
}

export function sampleAnimatedFrame(input: {
  readonly animations: LoadedSpriteAnimations;
  readonly snap: WorldEntitySnapshot;
  readonly dead: boolean;
  readonly moving: boolean;
  readonly timeSec: number;
}): SampledSpriteFrame | null {
  const { dir, flipX } = resolveFacingDirection(input.snap.facingX, input.snap.facingY);
  const state = resolveAnimState({ snap: input.snap, dead: input.dead, moving: input.moving });
  const clip = pickClipForState(input.animations, state, dir);
  if (!clip || clip.frames.length === 0) return null;
  const idx = resolveFrameIndex({ state, snap: input.snap, clip, timeSec: input.timeSec });
  const texture = clip.frames[idx];
  return texture ? { texture, flipX: state === STATE_CORPSE ? 1 : flipX } : null;
}
