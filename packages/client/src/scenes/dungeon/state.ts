// DungeonScene's mutable per-frame state bag: the fixed-step accumulator, the render-
// interpolation reference pose, and every subsystem's small local cosmetic state.
// One object per scene instance so no module holds state of its own.
import { createCameraFollowState, type CameraFollowState } from "./cameraFollow.js";
import { createProjectileVelocityState, type ProjectileVelocityState } from "./projectileVelocity.js";
import { createSelfCosmeticsState, type SelfCosmeticsState } from "./selfCosmetics.js";

export interface RenderPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DungeonSceneState {
  accumulatorMs: number;
  /** Self body pose just before the most recent fixed step — the interpolation source. */
  prevStep: RenderPose | null;
  readonly camera: CameraFollowState;
  readonly cosmetics: SelfCosmeticsState;
  readonly projectileVelocity: ProjectileVelocityState;
}

export function createDungeonSceneState(): DungeonSceneState {
  return {
    accumulatorMs: 0,
    prevStep: null,
    camera: createCameraFollowState(),
    cosmetics: createSelfCosmeticsState(),
    projectileVelocity: createProjectileVelocityState(),
  };
}
