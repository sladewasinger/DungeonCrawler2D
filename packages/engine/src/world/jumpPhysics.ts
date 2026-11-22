/** Pure parabolic vertical jump & fall integration shared across server simulation and client prediction. */

export const JUMP_VELOCITY_TILES_PER_SEC = 4.6;
export const JUMP_GRAVITY_TILES_PER_SEC2 = 22.0;
export const JUMP_VISUAL_PX_PER_TILE = 18;

export interface JumpState {
  readonly jumpZ: number;
  readonly jumpVz: number;
}

export function stepJumpArc(state: JumpState, jumpPressed: boolean, dtSeconds: number): JumpState {
  const startGrounded = state.jumpZ <= 0 && state.jumpVz <= 0;
  if (startGrounded && !jumpPressed) return { jumpZ: 0, jumpVz: 0 };
  const baseZ = startGrounded ? 0.001 : state.jumpZ;
  const baseVz = startGrounded ? JUMP_VELOCITY_TILES_PER_SEC : state.jumpVz;
  const nextVz = baseVz - JUMP_GRAVITY_TILES_PER_SEC2 * dtSeconds;
  const nextZ = baseZ + 0.5 * (baseVz + nextVz) * dtSeconds;
  if (nextZ <= 0) return { jumpZ: 0, jumpVz: 0 };
  return { jumpZ: nextZ, jumpVz: nextVz };
}
