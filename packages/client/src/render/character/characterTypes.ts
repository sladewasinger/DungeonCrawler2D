/** Shared character sprite constants, directional facing helpers, and frame pose types. */
import type { CharacterAppearance } from "@dc2d/engine";
import type { Texture } from "pixi.js";

export type FacingDir = "south" | "north" | "side";
export type CharacterAnimState = "idle" | "run" | "jump" | "fall";

export const CHARACTER_WORLD_SCALE = 0.75;
export const FRAME_SIZE = { w: 32, h: 32 } as const;
export const OUTLINE_RGB = [20, 16, 24] as const;
export const EYE_DARK = "#141018";
export const EYE_GLINT = "#f8fafc";
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

export interface DirectionAnim {
  readonly idle: readonly Texture[];
  readonly run: readonly Texture[];
  readonly jump?: readonly Texture[];
  readonly fall?: readonly Texture[];
}

export interface CharacterSpriteSet {
  readonly south: DirectionAnim;
  readonly north: DirectionAnim;
  readonly side: DirectionAnim;
  readonly previewUrl: string;
}

export interface CharacterMetrics {
  readonly slender: boolean;
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
  const slender = appearance.body === "slender";
  const torsoW = slender ? 8 : 10;
  const torsoX = slender ? 12 : 11;
  const armW = slender ? 2 : 3;
  const legW = slender ? 3 : 4;
  return {
    slender,
    torsoX,
    torsoW,
    armW,
    armLX: torsoX - armW,
    armRX: torsoX + torsoW,
    legW,
    legLX: torsoX,
    legRX: torsoX + torsoW - legW,
    sideTorsoX: slender ? 13 : 12,
    sideTorsoW: slender ? 6 : 8,
    b: pose.bobY,
    hb: pose.hairBobY,
    pose,
  };
}
