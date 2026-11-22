/** Shared character sprite constants, directional facing helpers, and canonical frame pose tables. */
import type { CharacterAppearance } from "@dc2d/engine";
import type { Texture } from "pixi.js";

export type FacingDir = "south" | "north" | "side";
export type CharacterAnimState = "idle" | "run" | "jump" | "fall";

export const CHARACTER_WORLD_SCALE = 0.75;
export const FRAME_SIZE = { w: 32, h: 32 } as const;
export const OUTLINE_RGB = [20, 16, 24] as const;
export const EYE_SCLERA = "#f1f5f9";
export const EYE_GLINT = "#ffffff";
export const BELT_DARK = "#2a201b";
export const SOLE_DARK = "#1c1917";

export interface CharacterPose {
  readonly bobY: number;
  readonly hairBobY: number;
  readonly stride: number;
  readonly liftL: number;
  readonly liftR: number;
  readonly armSwing: number;
  readonly shadowShrink: number;
}

export const IDLE_POSES: readonly CharacterPose[] = [
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: 1, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 1, shadowShrink: 0 },
  { bobY: 0, hairBobY: 1, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
];

export const RUN_POSES: readonly CharacterPose[] = [
  { bobY: -1, hairBobY: 0, stride: 3, liftL: 2, liftR: 0, armSwing: 2, shadowShrink: 1 },
  { bobY: -1, hairBobY: -1, stride: 2, liftL: 1, liftR: 0, armSwing: 1, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: -1, hairBobY: 0, stride: -3, liftL: 0, liftR: 2, armSwing: -2, shadowShrink: 1 },
  { bobY: -1, hairBobY: -1, stride: -2, liftL: 0, liftR: 1, armSwing: -1, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
];

export const JUMP_POSES: readonly CharacterPose[] = [
  { bobY: 0, hairBobY: 1, stride: 2, liftL: 2, liftR: 1, armSwing: -2, shadowShrink: 1 },
  { bobY: -1, hairBobY: 1, stride: 2, liftL: 2, liftR: 2, armSwing: -2, shadowShrink: 1 },
];

export const FALL_POSES: readonly CharacterPose[] = [
  { bobY: -1, hairBobY: -1, stride: -2, liftL: 1, liftR: 0, armSwing: 2, shadowShrink: 1 },
  { bobY: 0, hairBobY: -1, stride: -1, liftL: 0, liftR: 1, armSwing: 2, shadowShrink: 1 },
];

export interface DirectionAnim {
  readonly idle: readonly Texture[];
  readonly run: readonly Texture[];
  readonly jump: readonly Texture[];
  readonly fall: readonly Texture[];
}

export interface CharacterSpriteSet {
  readonly south: DirectionAnim;
  readonly north: DirectionAnim;
  readonly side: DirectionAnim;
  readonly frontArm: Texture;
  readonly backArm: Texture;
  readonly previewUrl: string;
}

export interface CharacterMetrics {
  readonly female: boolean;
  readonly torsoX: number;
  readonly torsoW: number;
  readonly armW: number;
  readonly armLX: number;
  readonly armRX: number;
  readonly legW: number;
  readonly legLX: number;
  readonly legRX: number;
  readonly sideTorsoX: number;
  readonly sideTorsoW: number;
  readonly b: number;
  readonly hb: number;
  readonly pose: CharacterPose;
}

export function resolveFacingDir(dx: number, dy: number): { readonly dir: FacingDir; readonly flipX: boolean } {
  if (Math.hypot(dx, dy) < 0.01) return { dir: "south", flipX: false };
  if (Math.abs(dx) >= Math.abs(dy) * 0.92) return { dir: "side", flipX: dx < 0 };
  return { dir: dy < 0 ? "north" : "south", flipX: false };
}

export function getCharacterMetrics(appearance: CharacterAppearance, pose: CharacterPose): CharacterMetrics {
  const female = appearance.body === "female";
  const torsoW = female ? 8 : 10;
  const torsoX = female ? 12 : 11;
  const armW = female ? 2 : 3;
  const legW = female ? 3 : 4;
  return {
    female,
    torsoX,
    torsoW,
    armW,
    armLX: torsoX - armW,
    armRX: torsoX + torsoW,
    legW,
    legLX: torsoX,
    legRX: torsoX + torsoW - legW,
    sideTorsoX: female ? 13 : 12,
    sideTorsoW: female ? 6 : 8,
    b: pose.bobY,
    hb: pose.hairBobY,
    pose,
  };
}

export interface SideLegMetrics {
  readonly legW: number;
  readonly footW: number;
  readonly bootToeW: number;
  readonly backLegX: number;
  readonly frontLegX: number;
}

export function getSideLegMetrics(m: CharacterMetrics): SideLegMetrics {
  const stride = Math.trunc((m.pose.stride * 2) / 3);
  return m.female
    ? { legW: 2, footW: 3, bootToeW: 3, backLegX: 15 - stride, frontLegX: 15 + stride }
    : { legW: 3, footW: 4, bootToeW: 4, backLegX: 14 - stride, frontLegX: 15 + stride };
}
