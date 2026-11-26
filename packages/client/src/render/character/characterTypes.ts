/** Shared character sprite constants, directional facing helpers, and canonical frame pose tables. */
import type { CharacterAppearance } from "@dc2d/engine";
import type { Texture } from "pixi.js";

export type FacingDir = "south" | "se" | "side" | "ne" | "north";
export type FacingDir4 = "south" | "north" | "side";

const DIR_SOUTH = "south" as const;
const DIR_NORTH = "north" as const;
const OCTANT_BANDS: readonly { readonly dir: FacingDir; readonly min: number; readonly max: number }[] = [
  { dir: DIR_NORTH, min: -90, max: -67.5 },
  { dir: "ne", min: -67.5, max: -22.5 },
  { dir: "side", min: -22.5, max: 22.5 },
  { dir: "se", min: 22.5, max: 67.5 },
  { dir: DIR_SOUTH, min: 67.5, max: 90 },
];

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

export const WALK_POSES: readonly CharacterPose[] = [
  { bobY: 0, hairBobY: 0, stride: 1, liftL: 1, liftR: 0, armSwing: 0.9, shadowShrink: 0 },
  { bobY: -1, hairBobY: 0, stride: 1, liftL: 1, liftR: 0, armSwing: 0.5, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: -1, liftL: 0, liftR: 1, armSwing: -0.9, shadowShrink: 0 },
  { bobY: -1, hairBobY: 0, stride: -1, liftL: 0, liftR: 1, armSwing: -0.5, shadowShrink: 0 },
  { bobY: 0, hairBobY: 0, stride: 0, liftL: 0, liftR: 0, armSwing: 0, shadowShrink: 0 },
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
  readonly walk?: readonly Texture[];
  readonly run: readonly Texture[];
  readonly jump: readonly Texture[];
  readonly fall: readonly Texture[];
  readonly dodge?: readonly Texture[];
  readonly downed?: readonly Texture[];
  readonly swim?: readonly Texture[];
  readonly bow?: readonly Texture[];
  readonly crouchIdle?: readonly Texture[];
  readonly crouchWalk?: readonly Texture[];
  readonly attack?: readonly Texture[];
}

export interface CharacterSpriteSet {
  readonly south: DirectionAnim;
  readonly se?: DirectionAnim;
  readonly north: DirectionAnim;
  readonly ne?: DirectionAnim;
  readonly side: DirectionAnim;
  readonly frontArm: Texture;
  readonly backArm: Texture;
  readonly worldScale?: number;
  readonly anchorY?: number;
  readonly is3d?: boolean;
  readonly hasSecondaryTracks?: boolean;
  readonly ensureSecondary?: () => void;
  readonly previewUrl?: string;
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

function pickDir8(deg: number, prevDir?: FacingDir): FacingDir {
  const prevBand = prevDir ? OCTANT_BANDS.find((b) => b.dir === prevDir) : undefined;
  if (prevBand && deg >= prevBand.min - 6 && deg <= prevBand.max + 6) return prevBand.dir;
  return OCTANT_BANDS.find((b) => deg >= b.min && deg <= b.max)?.dir ?? DIR_SOUTH;
}

export function resolveFacingDir(dx: number, dy: number): { readonly dir: FacingDir4; readonly flipX: boolean } {
  if (Math.hypot(dx, dy) < 0.01) return { dir: DIR_SOUTH, flipX: false };
  if (Math.abs(dx) >= Math.abs(dy) * 0.92) return { dir: "side", flipX: dx < 0 };
  return { dir: dy < 0 ? DIR_NORTH : DIR_SOUTH, flipX: false };
}

function pickFlipX(dx: number, dir: FacingDir, prevFlip?: boolean): boolean {
  if (dir === DIR_NORTH || dir === DIR_SOUTH) return false;
  return Math.abs(dx) > 0.08 ? dx < 0 : Boolean(prevFlip);
}

export function resolveFacingDir8(
  dx: number,
  dy: number,
  prev?: { readonly dir: FacingDir; readonly flipX: boolean },
): { readonly dir: FacingDir; readonly flipX: boolean } {
  if (Math.hypot(dx, dy) < 0.01) return prev ?? { dir: DIR_SOUTH, flipX: false };
  const dir = pickDir8(Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI), prev?.dir);
  return { dir, flipX: pickFlipX(dx, dir, prev?.flipX) };
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
