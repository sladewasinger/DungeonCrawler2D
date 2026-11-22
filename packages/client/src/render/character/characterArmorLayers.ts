/** Modular 32x32 4-directional visible armor layers (legs, boots, chest, head). */
import { ARMOR_VISUAL_STYLES, SKIN_PALETTES, getArmorVisualStyle, type ArmorVisualStyle } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import type { PixelRect } from "../textures/pixelCanvas.js";
import { BELT_DARK, SOLE_DARK, getCharacterMetrics, type CharacterMetrics, type FacingDir } from "./characterTypes.js";

function styleFor(id: string | null | undefined, fallback?: string): ArmorVisualStyle | undefined {
  return getArmorVisualStyle(id) ?? (id && fallback ? ARMOR_VISUAL_STYLES[fallback] : undefined);
}

function appendVerticalLowerArmor(out: PixelRect[], opts: {
  readonly armor: ArmorEquipment; readonly m: CharacterMetrics; readonly north: boolean;
}): void {
  const { armor, m, north } = opts;
  const { b, pose, torsoX, torsoW, legW, legLX, legRX } = m;
  const footTopL = 26 - pose.liftL;
  const footTopR = 26 - pose.liftR;
  const legs = styleFor(armor.legs);
  if (legs) {
    out.push(
      [torsoX, 20 + b, torsoW, 2, legs.shade],
      [legLX, 21 + b, legW, Math.max(2, footTopL - (21 + b)), legs.shade],
      [legRX, 21 + b, legW, Math.max(2, footTopR - (21 + b)), north ? legs.shade : legs.base],
    );
  }
  const boots = styleFor(armor.feet);
  if (!boots) return;
  out.push(
    [legLX, footTopL, legW, 1, boots.accent], [legRX, footTopR, legW, 1, boots.accent],
    [legLX, footTopL + 1, legW, 1, boots.shade], [legRX, footTopR + 1, legW, 1, north ? boots.shade : boots.base],
    [legLX, footTopL + 2, legW, 1, SOLE_DARK], [legRX, footTopR + 2, legW, 1, SOLE_DARK],
  );
}

function appendVerticalHeadArmor(out: PixelRect[], opts: {
  readonly head: ArmorVisualStyle; readonly b: number; readonly north: boolean;
}): void {
  const { head, b, north } = opts;
  if (north) {
    out.push([10, 3 + b, 12, 11, head.shade], [11, 3 + b, 10, 4, head.base], [13, 4 + b, 6, 2, head.highlight], [11, 13 + b, 10, 2, head.accent]);
    return;
  }
  out.push([10, 3 + b, 12, 3, head.base], [12, 3 + b, 8, 1, head.highlight], [9, 5 + b, 2, 8, head.shade], [21, 5 + b, 2, 8, head.base], [11, 13 + b, 10, 1, head.accent]);
}

function appendVerticalChestArmor(out: PixelRect[], opts: {
  readonly chest: ArmorVisualStyle; readonly m: CharacterMetrics; readonly north: boolean;
}): void {
  const { chest, m, north } = opts;
  const { b, pose, torsoX, torsoW, armW, armLX, armRX } = m;
  const armL = Math.max(-2, Math.min(2, pose.armSwing));
  out.push(
    [torsoX, 14 + b, torsoW, 7, north ? chest.shade : chest.base],
    [torsoX + 1, 15 + b, torsoW - 2, 3, north ? chest.base : chest.highlight],
    [torsoX, 19 + b, torsoW, 1, BELT_DARK],
    [Math.floor((armLX + armRX) / 2), 19 + b, 2, 1, chest.accent],
    [armLX, 14 + b + armL, armW, 4, chest.shade],
    [armRX, 14 + b - armL, armW, 4, north ? chest.shade : chest.base],
  );
}

function appendVerticalUpperArmor(out: PixelRect[], opts: {
  readonly armor: ArmorEquipment; readonly m: CharacterMetrics; readonly north: boolean;
}): void {
  const chest = styleFor(opts.armor.chest);
  if (chest) appendVerticalChestArmor(out, { chest, m: opts.m, north: opts.north });
  const head = styleFor(opts.armor.head, "leather-hood");
  if (head) appendVerticalHeadArmor(out, { head, b: opts.m.b, north: opts.north });
}

function appendSideLowerArmor(out: PixelRect[], armor: ArmorEquipment, m: CharacterMetrics): void {
  const { b, pose, sideTorsoX, sideTorsoW } = m;
  const backLegX = 14 - pose.stride;
  const frontLegX = 15 + pose.stride;
  const footTopL = 26 - pose.liftL;
  const footTopR = 26 - pose.liftR;
  const legs = styleFor(armor.legs);
  if (legs) {
    out.push([backLegX, 21 + b, 3, Math.max(2, footTopL - (21 + b)), legs.shade], [frontLegX, 21 + b, 3, Math.max(2, footTopR - (21 + b)), legs.base], [sideTorsoX, 20 + b, sideTorsoW, 2, legs.shade]);
  }
  const boots = styleFor(armor.feet);
  if (!boots) return;
  out.push(
    [backLegX, footTopL, 4, 1, boots.accent], [backLegX, footTopL + 1, 5, 1, boots.shade], [backLegX, footTopL + 2, 5, 1, SOLE_DARK],
    [frontLegX, footTopR, 4, 1, boots.accent], [frontLegX, footTopR + 1, 5, 1, boots.base], [frontLegX, footTopR + 2, 5, 1, SOLE_DARK],
  );
}

function appendSideUpperArmor(out: PixelRect[], input: {
  readonly armor: ArmorEquipment; readonly appearance: CharacterAppearance; readonly m: CharacterMetrics;
}): void {
  const { armor, appearance, m } = input;
  const { b, pose, sideTorsoX, sideTorsoW } = m;
  const skin = SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm!;
  const chest = styleFor(armor.chest);
  if (chest) {
    const frontArmX = 14 - pose.armSwing;
    out.push(
      [sideTorsoX, 14 + b, sideTorsoW, 7, chest.base], [sideTorsoX + 1, 15 + b, sideTorsoW - 2, 3, chest.highlight],
      [sideTorsoX, 14 + b, 2, 7, chest.shade], [sideTorsoX, 19 + b, sideTorsoW, 1, BELT_DARK],
      [sideTorsoX + sideTorsoW - 2, 19 + b, 2, 1, chest.accent], [frontArmX, 14 + b, 3, 4, chest.highlight], [frontArmX, 18 + b, 3, 3, skin.base],
    );
  }
  const head = styleFor(armor.head, "leather-hood");
  if (head) {
    out.push([11, 3 + b, 10, 3, head.base], [13, 3 + b, 6, 1, head.highlight], [9, 5 + b, 5, 8, head.shade], [11, 5 + b, 6, 6, head.base], [11, 13 + b, 6, 1, head.accent]);
  }
}

export function buildArmorRects(input: {
  readonly appearance: CharacterAppearance;
  readonly armor: ArmorEquipment;
  readonly dir: FacingDir;
  readonly pose: CharacterMetrics["pose"];
}): PixelRect[] {
  const m = getCharacterMetrics(input.appearance, input.pose);
  const out: PixelRect[] = [];
  if (input.dir === "side") {
    appendSideLowerArmor(out, input.armor, m);
    appendSideUpperArmor(out, { armor: input.armor, appearance: input.appearance, m });
    return out;
  }
  const north = input.dir === "north";
  appendVerticalLowerArmor(out, { armor: input.armor, m, north });
  appendVerticalUpperArmor(out, { armor: input.armor, m, north });
  return out;
}
