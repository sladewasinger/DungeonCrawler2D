/** Modular 32x32 4-directional pixel base body, limbs, expressive colored eyes, and under-tunic layers. */
import { EYE_PALETTES, SKIN_PALETTES, UNDERWEAR_PALETTE, type ToneTriad } from "@dc2d/content";
import type { CharacterAppearance } from "@dc2d/engine";
import type { PixelRect } from "../textures/pixelCanvas.js";
import {
  BELT_DARK, EYE_GLINT, EYE_SCLERA, getCharacterMetrics, getSideLegMetrics,
  type CharacterMetrics, type CharacterPose, type FacingDir,
} from "./characterTypes.js";

function southEyeRects(skin: ToneTriad, eye: ToneTriad, b: number): PixelRect[] {
  return [
    [12, 8 + b, 1, 1, skin.shade], [13, 8 + b, 2, 1, eye.shade],
    [12, 9 + b, 1, 2, EYE_SCLERA], [13, 9 + b, 2, 2, eye.base],
    [13, 9 + b, 1, 1, EYE_GLINT], [14, 10 + b, 1, 1, eye.highlight],
    [17, 8 + b, 2, 1, eye.shade], [19, 8 + b, 1, 1, skin.shade],
    [19, 9 + b, 1, 2, EYE_SCLERA], [17, 9 + b, 2, 2, eye.base],
    [17, 9 + b, 1, 1, EYE_GLINT], [18, 10 + b, 1, 1, eye.highlight],
  ];
}

function southHeadRects(opts: {
  readonly skin: ToneTriad; readonly eye: ToneTriad; readonly b: number; readonly north: boolean;
}): PixelRect[] {
  const { skin, eye, b, north } = opts;
  const rects: PixelRect[] = [
    [11, 4 + b, 10, 10, skin.base],
    [10, 5 + b, 12, 7, skin.base],
    [10, 8 + b, 1, 4, skin.shade],
    [21, 8 + b, 1, 4, skin.shade],
    [11, 12 + b, 10, 2, skin.shade],
    [12, 13 + b, 8, 1, skin.shade],
    [14, 13 + b, 4, 2, skin.shade],
  ];
  if (north) {
    rects.push([12, 5 + b, 8, 2, skin.highlight]);
    return rects;
  }
  rects.push([12, 5 + b, 7, 2, skin.highlight], ...southEyeRects(skin, eye, b));
  return rects;
}

function southChestRects(m: CharacterMetrics, north: boolean): PixelRect[] {
  const u = UNDERWEAR_PALETTE;
  const { b, torsoX, torsoW } = m;
  const base: PixelRect[] = [[torsoX, 14 + b, torsoW, 6, north ? u.shirtShade : u.shirt]];
  if (north || !m.female) {
    base.push([torsoX + 1, 15 + b, torsoW - 2, 3, north ? u.shirt : u.shirtHighlight]);
  } else {
    base.push(
      [13, 15 + b, 2, 2, u.shirtHighlight], [17, 15 + b, 2, 2, u.shirtHighlight],
      [13, 17 + b, 6, 1, u.shirtShade], [12, 18 + b, 1, 1, u.shirtShade], [19, 18 + b, 1, 1, u.shirtShade],
    );
  }
  base.push([torsoX, 19 + b, torsoW, 1, BELT_DARK], [torsoX, 20 + b, torsoW, 2, u.pants]);
  return base;
}

function verticalArmRects(skin: ToneTriad, m: CharacterMetrics, north: boolean): PixelRect[] {
  const u = UNDERWEAR_PALETTE;
  const { b, pose, armW, armLX, armRX } = m;
  const armL = Math.max(-2, Math.min(2, pose.armSwing));
  const armR = -armL;
  return [
    [armLX, 14 + b + armL, armW, 4, u.shirtShade],
    [armLX, 18 + b + armL, armW, 3, skin.shade],
    [armRX, 14 + b + armR, armW, 4, north ? u.shirtShade : u.shirt],
    [armRX, 18 + b + armR, armW, 3, north ? skin.shade : skin.base],
  ];
}

function buildSouthOrNorth(opts: {
  readonly skin: ToneTriad; readonly eye: ToneTriad; readonly m: CharacterMetrics;
  readonly north: boolean; readonly includeArms: boolean;
}): PixelRect[] {
  const { skin, eye, m, north, includeArms } = opts;
  const u = UNDERWEAR_PALETTE;
  const { b, pose, legW, legLX, legRX } = m;
  const footTopL = 26 - pose.liftL;
  const footTopR = 26 - pose.liftR;
  return [
    ...southHeadRects({ skin, eye, b, north }),
    ...(includeArms ? verticalArmRects(skin, m, north) : []),
    ...southChestRects(m, north),
    [legLX, 21 + b, legW, Math.max(2, footTopL - (21 + b)), u.pantsShade],
    [legLX, footTopL, legW, 2, skin.shade],
    [legLX, footTopL + 2, legW, 1, skin.shade],
    [legRX, 21 + b, legW, Math.max(2, footTopR - (21 + b)), u.pants],
    [legRX, footTopR, legW, 2, skin.base],
    [legRX, footTopR + 2, legW, 1, skin.shade],
  ];
}

function sideHeadRects(skin: ToneTriad, eye: ToneTriad, b: number): PixelRect[] {
  return [
    [12, 4 + b, 8, 10, skin.base],
    [11, 5 + b, 10, 7, skin.base],
    [21, 9 + b, 1, 2, skin.highlight],
    [14, 5 + b, 5, 2, skin.highlight],
    [11, 6 + b, 3, 6, skin.shade],
    [12, 12 + b, 8, 2, skin.shade],
    [14, 13 + b, 4, 2, skin.shade],
    [17, 8 + b, 1, 1, skin.shade],
    [18, 8 + b, 2, 1, eye.shade],
    [17, 9 + b, 1, 2, EYE_SCLERA],
    [18, 9 + b, 2, 2, eye.base],
    [18, 9 + b, 1, 1, EYE_GLINT],
    [19, 10 + b, 1, 1, eye.highlight],
  ];
}

function sideChestRects(m: CharacterMetrics): PixelRect[] {
  const u = UNDERWEAR_PALETTE;
  const { b, sideTorsoX, sideTorsoW } = m;
  if (m.female) {
    return [
      [13, 14 + b, 6, 3, u.shirt], [13, 14 + b, 2, 3, u.shirtShade],
      [19, 15 + b, 1, 3, u.shirt], [18, 15 + b, 2, 2, u.shirtHighlight],
      [14, 17 + b, 5, 2, u.shirt], [14, 17 + b, 1, 2, u.shirtShade], [18, 17 + b, 2, 1, u.shirtShade],
      [14, 19 + b, 5, 1, BELT_DARK], [13, 20 + b, 6, 2, u.pants], [13, 20 + b, 2, 2, u.pantsShade],
    ];
  }
  return [
    [sideTorsoX, 14 + b, sideTorsoW, 6, u.shirt],
    [sideTorsoX, 14 + b, 2, 6, u.shirtShade],
    [15, 15 + b, 4, 3, u.shirtHighlight],
    [sideTorsoX, 19 + b, sideTorsoW, 1, BELT_DARK],
    [sideTorsoX, 20 + b, sideTorsoW, 2, u.pants],
  ];
}

function buildSideBody(opts: {
  readonly skin: ToneTriad; readonly eye: ToneTriad; readonly m: CharacterMetrics; readonly includeArms: boolean;
}): PixelRect[] {
  const { skin, eye, m, includeArms } = opts;
  const u = UNDERWEAR_PALETTE;
  const { b, pose } = m;
  const legs = getSideLegMetrics(m);
  const footTopL = 26 - pose.liftL;
  const footTopR = 26 - pose.liftR;
  const backArmX = 15 + pose.armSwing;
  const frontArmX = 14 - pose.armSwing;
  const backArm: PixelRect[] = includeArms ? [[backArmX, 14 + b, 3, 4, u.shirtShade], [backArmX + 1, 18 + b, 2, 3, skin.shade]] : [];
  const frontArm: PixelRect[] = includeArms ? [[frontArmX, 14 + b, 3, 4, u.shirt], [frontArmX, 18 + b, 3, 3, skin.base]] : [];
  return [
    ...backArm,
    [legs.backLegX, 21 + b, legs.legW, Math.max(2, footTopL - (21 + b)), u.pantsShade],
    [legs.backLegX, footTopL, legs.footW, 2, skin.shade], [legs.backLegX, footTopL + 2, legs.footW, 1, skin.shade],
    [legs.frontLegX, 21 + b, legs.legW, Math.max(2, footTopR - (21 + b)), u.pants],
    [legs.frontLegX, footTopR, legs.footW, 2, skin.base], [legs.frontLegX, footTopR + 2, legs.footW, 1, skin.shade],
    ...sideChestRects(m),
    ...sideHeadRects(skin, eye, b),
    ...frontArm,
  ];
}

export function buildBodyRects(input: {
  readonly appearance: CharacterAppearance;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
  readonly includeArms?: boolean | undefined;
}): PixelRect[] {
  const skin = SKIN_PALETTES[input.appearance.skin] ?? SKIN_PALETTES.warm!;
  const eye = EYE_PALETTES[input.appearance.eyeColor] ?? EYE_PALETTES.brown!;
  const m = getCharacterMetrics(input.appearance, input.pose);
  const includeArms = Boolean(input.includeArms);
  if (input.dir === "side") return buildSideBody({ skin, eye, m, includeArms });
  return buildSouthOrNorth({ skin, eye, m, north: input.dir === "north", includeArms });
}
