/** Pure parabolic vertical jump, fall integration, and foot-elevation support checks. */
import { clamp } from "../math/noise.js";

export const JUMP_VELOCITY_TILES_PER_SEC = 5.5;
export const JUMP_GRAVITY_TILES_PER_SEC2 = 22.0;
export const JUMP_VISUAL_PX_PER_TILE = 18;
export const ELEVATION_DROP_TO_JUMP_Z = 10 / JUMP_VISUAL_PX_PER_TILE;

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

export function forEachFootTile(
  pos: {
    readonly x: number; readonly y: number; readonly radius: number;
    readonly footHalfX?: number | undefined; readonly footSegX?: number | undefined; readonly footSegY?: number | undefined;
  },
  fn: (tx: number, ty: number) => boolean,
): boolean {
  const rx = Math.abs(pos.footSegX ?? pos.footHalfX ?? 0) + pos.radius;
  const footDepth = pos.footSegY ? Math.min(Math.abs(pos.footSegY) + pos.radius, 0.24) : Math.min(pos.radius, 0.14);
  const minTx = Math.floor(pos.x - rx);
  const maxTx = Math.floor(pos.x + rx);
  const minTy = Math.floor(pos.y - footDepth);
  const maxTy = Math.floor(pos.y + footDepth);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!fn(tx, ty)) return false;
    }
  }
  return true;
}

export function resolveDestElevation(
  sampleElevation: (tx: number, ty: number) => number,
  dest: {
    readonly x: number; readonly y: number; readonly radius: number;
    readonly footHalfX?: number | undefined; readonly footSegX?: number | undefined; readonly footSegY?: number | undefined;
    readonly elevation: number; readonly airborne: boolean; readonly stairs: boolean;
  },
): { readonly nextElevation: number; readonly elevationDrop: number } {
  if (dest.stairs) return { nextElevation: dest.elevation, elevationDrop: 0 };
  if (!dest.airborne) {
    return { nextElevation: clamp(sampleElevation(Math.floor(dest.x), Math.floor(dest.y)), 0, 2), elevationDrop: 0 };
  }
  let min = 2;
  let max = 0;
  forEachFootTile(dest, (tx, ty) => {
    const e = sampleElevation(tx, ty);
    min = Math.min(min, e);
    max = Math.max(max, e);
    return true;
  });
  const maxSupport = clamp(max, 0, 2);
  if (maxSupport < dest.elevation) return { nextElevation: maxSupport, elevationDrop: dest.elevation - maxSupport };
  const minSupport = clamp(min, 0, 2);
  if (minSupport > dest.elevation) return { nextElevation: minSupport, elevationDrop: dest.elevation - minSupport };
  return { nextElevation: dest.elevation, elevationDrop: 0 };
}
