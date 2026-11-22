/** Resolves 4-directional spritesheet facing, state clip selection, frame timing, and attack outro recovery. */
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

export interface AnimatorTrackState {
  prevState: SpriteAnimState | null;
  lastAttackClip: LoadedSpriteClip | null;
  lastAttackFlipX: 1 | -1;
  outroClip: LoadedSpriteClip | null;
  outroFlipX: 1 | -1;
  outroStartSec: number;
  outroDurationSec: number;
}

export function createAnimatorTrackState(): AnimatorTrackState {
  return {
    prevState: null,
    lastAttackClip: null,
    lastAttackFlipX: 1,
    outroClip: null,
    outroFlipX: 1,
    outroStartSec: 0,
    outroDurationSec: 0,
  };
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

function resolveLoopSpan(clip: LoadedSpriteClip, len: number): { readonly start: number; readonly count: number } {
  const start = Math.max(0, Math.min(len - 1, clip.loopStart ?? 0));
  const end = Math.max(start + 1, Math.min(len, clip.loopEnd ?? len));
  return { start, count: end - start };
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
    const introLen = input.clip.loopStart && input.clip.loopStart > 0 ? Math.min(len, input.clip.loopStart) : len;
    return Math.min(introLen - 1, Math.floor(Math.max(0, input.snap.telegraphProgress) * introLen));
  }
  const { start, count } = resolveLoopSpan(input.clip, len);
  const phase = Math.abs(input.snap.x * 0.37 + input.snap.y * 0.19);
  return start + (Math.floor(Math.max(0, input.timeSec) * input.clip.fps + phase) % count);
}

function maybeBeginAttackOutro(track: AnimatorTrackState, state: SpriteAnimState, timeSec: number): void {
  const prev = track.prevState;
  track.prevState = state;
  if (state === STATE_CORPSE || state === STATE_ATTACK) { track.outroClip = null; return; }
  if (prev !== STATE_ATTACK) return;
  const atk = track.lastAttackClip;
  if (!atk || atk.loopEnd === undefined || atk.loopEnd >= atk.frames.length) return;
  track.outroClip = atk;
  track.outroFlipX = track.lastAttackFlipX;
  track.outroStartSec = timeSec;
  track.outroDurationSec = Math.max(0.3, (atk.frames.length - atk.loopEnd) / 7);
}

function sampleOutroFrame(track: AnimatorTrackState, timeSec: number): SampledSpriteFrame | null {
  const clip = track.outroClip;
  if (!clip || clip.loopEnd === undefined) return null;
  const elapsed = timeSec - track.outroStartSec;
  if (elapsed < 0 || elapsed >= track.outroDurationSec) {
    track.outroClip = null;
    return null;
  }
  const count = clip.frames.length - clip.loopEnd;
  const offset = Math.min(count - 1, Math.floor((elapsed / track.outroDurationSec) * count));
  const texture = clip.frames[clip.loopEnd + offset];
  return texture ? { texture, flipX: track.outroFlipX } : null;
}

function resolveTrackOutro(
  track: AnimatorTrackState | undefined,
  opts: {
    readonly state: SpriteAnimState;
    readonly clip: LoadedSpriteClip | null;
    readonly flipX: 1 | -1;
    readonly timeSec: number;
  },
): SampledSpriteFrame | null {
  if (!track) return null;
  if (opts.state === STATE_ATTACK && opts.clip) {
    track.lastAttackClip = opts.clip;
    track.lastAttackFlipX = opts.flipX;
  }
  maybeBeginAttackOutro(track, opts.state, opts.timeSec);
  return sampleOutroFrame(track, opts.timeSec);
}

export function sampleAnimatedFrame(input: {
  readonly animations: LoadedSpriteAnimations;
  readonly track?: AnimatorTrackState | undefined;
  readonly snap: WorldEntitySnapshot;
  readonly dead: boolean;
  readonly moving: boolean;
  readonly timeSec: number;
}): SampledSpriteFrame | null {
  const { dir, flipX } = resolveFacingDirection(input.snap.facingX, input.snap.facingY);
  const state = resolveAnimState({ snap: input.snap, dead: input.dead, moving: input.moving });
  const clip = pickClipForState(input.animations, state, dir);
  const outro = resolveTrackOutro(input.track, { state, clip, flipX, timeSec: input.timeSec });
  if (outro) return outro;
  if (!clip || clip.frames.length === 0) return null;
  const idx = resolveFrameIndex({ state, snap: input.snap, clip, timeSec: input.timeSec });
  const texture = clip.frames[idx];
  return texture ? { texture, flipX: state === STATE_CORPSE ? 1 : flipX } : null;
}
