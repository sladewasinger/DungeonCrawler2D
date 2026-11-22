/** Modular 32x32 4-directional pixel base body, limbs, and under-tunic layers. */
import { SKIN_PALETTES, UNDERWEAR_PALETTE, type ToneTriad } from "@dc2d/content";
import type { CharacterAppearance } from "@dc2d/engine";
import type { PixelRect } from "../textures/pixelCanvas.js";
import {
  BELT_DARK, EYE_DARK, EYE_GLINT, getCharacterMetrics,
  type CharacterMetrics, type CharacterPose, type FacingDir,
} from "./characterTypes.js";

function southHeadRects(skin: ToneTriad, b: number, north: boolean): PixelRect[] {
  const rects: PixelRect[] = [
    [11, 4 + b, 10, 10, skin.base],
    [10, 5 + b, 12, 7, skin.base],
    [12, 5 + b, 7, 2, skin.highlight],
    [10, 8 + b, 1, 4, skin.shade],
    [21, 8 + b, 1, 4, skin.shade],
    [11, 12 + b, 10, 2, skin.shade],
    [12, 13 + b, 8, 1, skin.shade],
    [14, 13 + b, 4, 2, skin.shade],
  ];
  if (north) {
    rects.push([11, 5 + b, 10, 7, skin.shade], [13, 6 + b, 6, 3, skin.base]);
    return rects;
  }
  rects.push(
    [12, 7 + b, 2, 1, skin.shade], [18, 7 + b, 2, 1, skin.shade],
    [12, 8 + b, 2, 3, EYE_DARK], [18, 8 + b, 2, 3, EYE_DARK],
    [12, 8 + b, 1, 1, EYE_GLINT], [18, 8 + b, 1, 1, EYE_GLINT],
  );
  return rects;
}

function buildSouthOrNorth(skin: ToneTriad, m: CharacterMetrics, north: boolean): PixelRect[] {
  const u = UNDERWEAR_PALETTE;
  const { b, pose, torsoX, torsoW, armW, armLX, armRX, legW, legLX, legRX } = m;
  const footTopL = 26 - pose.liftL;
  const footTopR = 26 - pose.liftR;
  const armL = Math.max(-2, Math.min(2, pose.armSwing));
  const armR = -armL;
  return [
    ...southHeadRects(skin, b, north),
    [armLX, 14 + b + armL, armW, 4, u.shirtShade],
    [armLX, 18 + b + armL, armW, 3, skin.shade],
    [armRX, 14 + b + armR, armW, 4, north ? u.shirtShade : u.shirt],
    [armRX, 18 + b + armR, armW, 3, north ? skin.shade : skin.base],
    [torsoX, 14 + b, torsoW, 6, north ? u.shirtShade : u.shirt],
    [torsoX + 1, 15 + b, torsoW - 2, 3, north ? u.shirt : u.shirtHighlight],
    [torsoX, 19 + b, torsoW, 1, BELT_DARK],
    [torsoX, 20 + b, torsoW, 2, u.pants],
    [legLX, 21 + b, legW, Math.max(2, footTopL - (21 + b)), u.pantsShade],
    [legLX, footTopL, legW, 2, skin.shade],
    [legLX, footTopL + 2, legW, 1, skin.shade],
    [legRX, 21 + b, legW, Math.max(2, footTopR - (21 + b)), u.pants],
    [legRX, footTopR, legW, 2, skin.base],
    [legRX, footTopR + 2, legW, 1, skin.shade],
  ];
}

function sideHeadRects(skin: ToneTriad, b: number): PixelRect[] {
  return [
    [12, 4 + b, 8, 10, skin.base],
    [11, 5 + b, 10, 7, skin.base],
    [21, 9 + b, 1, 2, skin.highlight],
    [14, 5 + b, 5, 2, skin.highlight],
    [11, 6 + b, 3, 6, skin.shade],
    [12, 12 + b, 8, 2, skin.shade],
    [14, 13 + b, 4, 2, skin.shade],
    [18, 7 + b, 2, 1, skin.shade],
    [18, 8 + b, 2, 3, EYE_DARK],
    [19, 8 + b, 1, 1, EYE_GLINT],
  ];
}

function buildSideBody(skin: ToneTriad, m: CharacterMetrics): PixelRect[] {
  const u = UNDERWEAR_PALETTE;
  const { b, pose, sideTorsoX, sideTorsoW } = m;
  const backLegX = 14 - pose.stride;
  const frontLegX = 15 + pose.stride;
  const footTopL = 26 - pose.liftL;
  const footTopR = 26 - pose.liftR;
  const backArmX = 15 + pose.armSwing;
  const frontArmX = 14 - pose.armSwing;
  return [
    [backArmX, 14 + b, 3, 4, u.shirtShade],
    [backArmX + 1, 18 + b, 2, 3, skin.shade],
    [backLegX, 21 + b, 3, Math.max(2, footTopL - (21 + b)), u.pantsShade],
    [backLegX, footTopL, 4, 2, skin.shade],
    [backLegX, footTopL + 2, 4, 1, skin.shade],
    [frontLegX, 21 + b, 3, Math.max(2, footTopR - (21 + b)), u.pants],
    [frontLegX, footTopR, 4, 2, skin.base],
    [frontLegX, footTopR + 2, 4, 1, skin.shade],
    [sideTorsoX, 14 + b, sideTorsoW, 6, u.shirt],
    [sideTorsoX + 1, 15 + b, sideTorsoW - 2, 3, u.shirtHighlight],
    [sideTorsoX, 14 + b, 2, 6, u.shirtShade],
    [sideTorsoX, 19 + b, sideTorsoW, 1, BELT_DARK],
    [sideTorsoX, 20 + b, sideTorsoW, 2, u.pants],
    ...sideHeadRects(skin, b),
    [frontArmX, 14 + b, 3, 4, u.shirt],
    [frontArmX, 18 + b, 3, 3, skin.base],
  ];
}

export function buildBodyRects(input: {
  readonly appearance: CharacterAppearance;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
}): PixelRect[] {
  const skin = SKIN_PALETTES[input.appearance.skin] ?? SKIN_PALETTES.warm!;
  const m = getCharacterMetrics(input.appearance, input.pose);
  if (input.dir === "side") return buildSideBody(skin, m);
  return buildSouthOrNorth(skin, m, input.dir === "north");
}
