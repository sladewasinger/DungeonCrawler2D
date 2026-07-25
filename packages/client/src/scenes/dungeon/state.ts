// DungeonScene's mutable per-frame state bag: the fixed-step accumulator, the render-
// interpolation reference pose, and every subsystem's small local cosmetic state.
// One object per scene instance so no module holds state of its own.
import { NEUTRAL_INPUT, type MoveInput } from "@dc2d/engine";
import type { PendingSwing } from "../../vfx/meleeConnect.js";
import { createCameraFollowState, type CameraFollowState } from "./cameraFollow.js";
import { createProjectileVelocityState, type ProjectileVelocityState } from "./projectileVelocity.js";
import { createSelfCosmeticsState, type SelfCosmeticsState } from "./selfCosmetics.js";
import { createWallBumpState, type WallBumpState } from "../../input/wallBump.js";
import {
  createFrameEntityBuckets,
  type FrameEntityBuckets,
} from "./frameEntityBuckets.js";

export interface RenderPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DungeonSceneState {
  accumulatorMs: number;
  /** Self body pose just before the most recent fixed step — the interpolation source. */
  renderInput: MoveInput;
  readonly camera: CameraFollowState;
  readonly cosmetics: SelfCosmeticsState;
  readonly projectileVelocity: ProjectileVelocityState;
  readonly entityBuckets: FrameEntityBuckets;
  /** Per-player id `attacking` from the previous frame — meleeSwingEvents.ts's edge detector for spawning the swing-wedge telegraph. */
  readonly attackFlags: Map<string, boolean>;
  /** Panel round 3b item 5 (WHIFF FEEDBACK): swings awaiting a correlating "hit" event,
   * keyed by attacker id — see vfx/meleeConnect.ts. */
  readonly pendingSwings: Map<string, PendingSwing>;
  /** Panel round 3b item 4 (WALL-BUMP FEEDBACK): the throttle/edge-trigger tracker fed
   * from real predicted-movement deltas each fixed step — see input/wallBump.ts. */
  readonly wallBump: WallBumpState;
}

export function createDungeonSceneState(): DungeonSceneState {
  return {
    accumulatorMs: 0,
    renderInput: NEUTRAL_INPUT,
    camera: createCameraFollowState(),
    cosmetics: createSelfCosmeticsState(),
    projectileVelocity: createProjectileVelocityState(),
    entityBuckets: createFrameEntityBuckets(),
    attackFlags: new Map(),
    pendingSwings: new Map(),
    wallBump: createWallBumpState(),
  };
}
