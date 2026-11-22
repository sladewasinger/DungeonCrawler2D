/** Pixel rects for the modular base body, hair styles, and visible equipment layers. */
import { ARMOR_VISUAL_STYLES, HAIR_PALETTES, SKIN_PALETTES, UNDERWEAR_PALETTE, getArmorVisualStyle } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import type { PixelRect } from "../textures/pixelCanvas.js";

export interface CharacterPose {
  readonly bobY: number;
  readonly leftLegDy: number;
  readonly rightLegDy: number;
  readonly armSwing: number;
}

const EYE_DARK = "#141018";

interface LayoutMetrics {
  readonly torsoX: number;
  readonly torsoW: number;
  readonly armLX: number;
  readonly armRX: number;
  readonly legRX: number;
  readonly b: number;
  readonly pose: CharacterPose;
}

export function getLayoutMetrics(appearance: CharacterAppearance, pose: CharacterPose): LayoutMetrics {
  const slender = appearance.body === "slender";
  return {
    torsoX: slender ? 7 : 6,
    torsoW: slender ? 6 : 8,
    armLX: slender ? 5 : 4,
    armRX: slender ? 13 : 14,
    legRX: slender ? 10 : 11,
    b: pose.bobY,
    pose,
  };
}

export function buildBodyRects(appearance: CharacterAppearance, m: LayoutMetrics): PixelRect[] {
  const skin = SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm!;
  const u = UNDERWEAR_PALETTE;
  const { b, pose, torsoX, torsoW, armLX, armRX, legRX } = m;
  return [
    [6, 6 + b, 8, 7, skin.base],
    [6, 7 + b, 2, 4, skin.shade],
    [6, 11 + b, 8, 2, skin.shade],
    [8, 7 + b, 4, 2, skin.highlight],
    [9, 9 + b, 1, 2, EYE_DARK],
    [12, 9 + b, 1, 2, EYE_DARK],
    [armLX, 13 + b + pose.armSwing, 2, 3, u.shirtShade],
    [armRX, 13 + b - pose.armSwing, 2, 3, u.shirt],
    [armLX, 16 + b + pose.armSwing, 2, 2, skin.shade],
    [armRX, 16 + b - pose.armSwing, 2, 2, skin.base],
    [torsoX, 13 + b, torsoW, 5, u.shirt],
    [torsoX + 1, 14 + b, torsoW - 2, 2, u.shirtHighlight],
    [torsoX, 17 + b, torsoW, 2, u.pants],
    [7, 19 + b + pose.leftLegDy, 2, 2, u.pantsShade],
    [legRX, 19 + b + pose.rightLegDy, 2, 2, u.pants],
    [7, 21 + b + pose.leftLegDy, 2, 3, skin.shade],
    [legRX, 21 + b + pose.rightLegDy, 2, 3, skin.base],
  ];
}

export function buildHairRects(appearance: CharacterAppearance, b: number, hooded: boolean): PixelRect[] {
  const pal = HAIR_PALETTES[appearance.hairColor] ?? HAIR_PALETTES.brown!;
  const style = appearance.hairStyle;
  if (style === "bald") return [];
  const out: PixelRect[] = [];
  if (!hooded) {
    out.push([6, 5 + b, 8, 3, pal.base], [7, 5 + b, 5, 1, pal.highlight], [6, 7 + b, 2, 2, pal.shade]);
  }
  if (style === "spiky" && !hooded) {
    out.push([6, 3 + b, 2, 2, pal.base], [9, 2 + b, 3, 3, pal.highlight], [12, 3 + b, 2, 2, pal.base]);
  } else if (style === "long") {
    out.push([5, 7 + b, 2, 8, pal.shade], [13, 7 + b, 2, 6, pal.base]);
  } else if (style === "ponytail") {
    out.push([4, 7 + b, 2, 5, pal.shade], [3, 10 + b, 2, 5, pal.base]);
  }
  return out;
}

export function buildArmorRects(armor: ArmorEquipment, m: LayoutMetrics): PixelRect[] {
  const out: PixelRect[] = [];
  const { b, pose, torsoX, torsoW, armLX, armRX, legRX } = m;
  const legs = getArmorVisualStyle(armor.legs);
  if (legs) {
    out.push([torsoX, 18 + b, torsoW, 1, legs.shade], [7, 19 + b + pose.leftLegDy, 2, 3, legs.shade], [legRX, 19 + b + pose.rightLegDy, 2, 3, legs.base]);
  }
  const boots = getArmorVisualStyle(armor.feet);
  if (boots) {
    out.push([7, 21 + b + pose.leftLegDy, 2, 1, boots.accent], [legRX, 21 + b + pose.rightLegDy, 2, 1, boots.accent], [7, 22 + b + pose.leftLegDy, 2, 2, boots.shade], [legRX, 22 + b + pose.rightLegDy, 2, 2, boots.base]);
  }
  const chest = getArmorVisualStyle(armor.chest);
  if (chest) {
    out.push([torsoX, 13 + b, torsoW, 6, chest.base], [torsoX + 1, 14 + b, torsoW - 2, 2, chest.highlight], [torsoX, 17 + b, torsoW, 1, chest.shade], [9, 17 + b, 2, 1, chest.accent], [armLX, 13 + b + pose.armSwing, 2, 2, chest.shade], [armRX, 13 + b - pose.armSwing, 2, 2, chest.base]);
  }
  const head = getArmorVisualStyle(armor.head) ?? (armor.head ? ARMOR_VISUAL_STYLES["leather-hood"] : undefined);
  if (head) {
    out.push([5, 4 + b, 10, 3, head.base], [7, 4 + b, 6, 1, head.highlight], [5, 7 + b, 2, 6, head.shade], [13, 7 + b, 2, 5, head.base], [7, 12 + b, 6, 1, head.accent]);
  }
  return out;
}

export function buildCharacterFrameRects(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly pose: CharacterPose;
}): PixelRect[] {
  const metrics = getLayoutMetrics(input.appearance, input.pose);
  const body = buildBodyRects(input.appearance, metrics);
  const armor = buildArmorRects(input.armor, metrics);
  const hair = buildHairRects(input.appearance, metrics.b, Boolean(input.armor.head));
  return [...body, ...armor, ...hair];
}
