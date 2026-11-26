/** Hybrid weapon grip-socket transform, sprite arm baking, and shoulder-pivoted arm IK solver. */
import { ARMOR_VISUAL_STYLES, SKIN_PALETTES, UNDERWEAR_PALETTE, getArmorVisualStyle } from "@dc2d/content";
import type { ArmorEquipment, CharacterAppearance } from "@dc2d/engine";
import type { PixelRect } from "../textures/pixelCanvas.js";
import { CHARACTER_WORLD_SCALE, type CharacterPose } from "./characterTypes.js";
import type { CardinalFacing, HeldLayout, MainHandPlacement } from "./heldPlacement.js";
import type { GripSocket, WeaponGripSockets } from "./heldWeapons.js";

export type AirborneState = "ground" | "jump" | "fall";

export const ARM_PIVOT_ANCHOR = { x: 2.5 / 11, y: 0.5 } as const;
const ARM_WORLD_LEN = 5.5 * CHARACTER_WORLD_SCALE;

export interface ArmPlacement {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly behindBody: boolean;
  readonly overWeapon: boolean;
  readonly shaded: boolean;
}

export interface ArmRigPose {
  readonly right: ArmPlacement;
  readonly left: ArmPlacement;
}

interface ShoulderDef {
  readonly x: number;
  readonly behind: boolean;
  readonly shaded: boolean;
  readonly sideSign: number;
}

interface ArmColors {
  readonly sleeve: string;
  readonly highlight: string;
  readonly shade: string;
  readonly hand: string;
}

interface Point2D {
  readonly x: number;
  readonly y: number;
}

const AIR_SPREAD: Readonly<Record<AirborneState, number>> = { ground: 0, jump: 0.4, fall: 0.68 };
const DEFAULT_SKIN = { base: "#f1c27d", shade: "#c68642" } as const;

export function armCanvasSize(female: boolean): { readonly w: number; readonly h: number } {
  return { w: 11, h: female ? 6 : 7 };
}

function resolveArmColors(appearance: CharacterAppearance, armor: ArmorEquipment, shaded: boolean): ArmColors {
  const skin = SKIN_PALETTES[appearance.skin] ?? SKIN_PALETTES.warm ?? DEFAULT_SKIN;
  const chest = getArmorVisualStyle(armor.chest) ?? ARMOR_VISUAL_STYLES[armor.chest ?? ""];
  const palette = chest ?? { base: UNDERWEAR_PALETTE.shirt, highlight: UNDERWEAR_PALETTE.shirtHighlight, shade: UNDERWEAR_PALETTE.shirtShade };
  return { sleeve: shaded ? palette.shade : palette.base, highlight: palette.highlight, shade: palette.shade, hand: shaded ? skin.shade : skin.base };
}

export function buildArmRects(input: {
  readonly appearance: CharacterAppearance; readonly armor: ArmorEquipment; readonly shaded: boolean;
}): PixelRect[] {
  const armH = input.appearance.body === "female" ? 2 : 3;
  const c = resolveArmColors(input.appearance, input.armor, input.shaded);
  const rects: PixelRect[] = [[1, 2, 5, armH, c.sleeve]];
  if (!input.shaded) rects.push([1, 2, 5, 1, c.highlight]);
  if (armH === 3) rects.push([1, 4, 5, 1, c.shade]);
  rects.push([6, 2, 3, armH, c.hand]);
  return rects;
}

function transformWeaponSocket(main: MainHandPlacement, socket: { readonly x: number; readonly y: number }): Point2D {
  const sx = socket.x * main.scaleX;
  const sy = socket.y * main.scaleY;
  const cos = Math.cos(main.rotation);
  const sin = Math.sin(main.rotation);
  return { x: main.x + sx * cos - sy * sin, y: main.y + sx * sin + sy * cos };
}

function shoulderPair(facing: CardinalFacing, torsoHalf: number): { readonly right: ShoulderDef; readonly left: ShoulderDef } {
  if (facing === "south") {
    return { right: { x: -torsoHalf, behind: false, shaded: false, sideSign: -1 }, left: { x: torsoHalf, behind: false, shaded: false, sideSign: 1 } };
  }
  if (facing === "north") {
    return { right: { x: torsoHalf, behind: true, shaded: true, sideSign: 1 }, left: { x: -torsoHalf, behind: true, shaded: true, sideSign: -1 } };
  }
  if (facing === "east") {
    return { right: { x: -0.4, behind: false, shaded: false, sideSign: -1 }, left: { x: 0.8, behind: true, shaded: true, sideSign: 1 } };
  }
  return { right: { x: -0.8, behind: true, shaded: true, sideSign: -1 }, left: { x: 0.4, behind: false, shaded: false, sideSign: 1 } };
}

function aimArmAt(opts: {
  readonly def: ShoulderDef; readonly sy: number; readonly target: Point2D;
  readonly behindBody: boolean; readonly overWeapon: boolean; readonly maxStretch?: number;
}): ArmPlacement {
  const dx = opts.target.x - opts.def.x;
  const dy = opts.target.y - opts.sy;
  const rotation = Math.atan2(dy, dx);
  const maxStretch = opts.maxStretch ?? 1.25;
  const stretch = Math.max(0.45, Math.min(maxStretch, Math.hypot(dx, dy) / ARM_WORLD_LEN));
  return {
    x: opts.def.x, y: opts.sy, rotation,
    scaleX: CHARACTER_WORLD_SCALE * stretch,
    scaleY: Math.cos(rotation) < -0.05 ? -CHARACTER_WORLD_SCALE : CHARACTER_WORLD_SCALE,
    behindBody: opts.behindBody, overWeapon: opts.overWeapon, shaded: opts.def.shaded,
  };
}

function tuckedArm(def: ShoulderDef, sy: number): ArmPlacement {
  return {
    x: def.x, y: sy, rotation: Math.PI / 2,
    scaleX: CHARACTER_WORLD_SCALE * 0.45, scaleY: CHARACTER_WORLD_SCALE,
    behindBody: def.behind, overWeapon: false, shaded: def.shaded,
  };
}

function shouldTuckInFrontBack(facing: CardinalFacing, def: ShoulderDef, tx: number): boolean {
  if (facing === "east" || facing === "west") return false;
  return tx * def.sideSign < 1.2;
}

function connectOrTuck(opts: {
  readonly facing: CardinalFacing; readonly def: ShoulderDef; readonly sy: number;
  readonly target: Point2D; readonly behindBody: boolean; readonly overWeapon: boolean;
  readonly forceReach?: boolean;
}): ArmPlacement {
  if (!opts.forceReach && shouldTuckInFrontBack(opts.facing, opts.def, opts.target.x)) return tuckedArm(opts.def, opts.sy);
  return aimArmAt({
    def: opts.def, sy: opts.sy, target: opts.target, behindBody: opts.behindBody,
    overWeapon: opts.overWeapon, maxStretch: opts.forceReach ? 1.7 : 1.25,
  });
}

function hangingArm(opts: {
  readonly def: ShoulderDef; readonly sy: number; readonly facing: CardinalFacing;
  readonly pose: CharacterPose; readonly airborne: AirborneState; readonly isRight: boolean;
}): ArmPlacement {
  const { def, sy, facing, pose, airborne, isRight } = opts;
  const sign = isRight ? 1 : -1;
  let swing = -def.sideSign * (AIR_SPREAD[airborne] + Math.max(0, sign * pose.armSwing) * 0.04);
  if (facing === "east" || facing === "west") {
    const active = pose.stride !== 0 || airborne !== "ground";
    swing = active ? (facing === "west" ? -1 : 1) * sign * (-pose.armSwing * 0.22) : 0;
  }
  return {
    x: def.x, y: sy, rotation: Math.PI / 2 + swing,
    scaleX: CHARACTER_WORLD_SCALE, scaleY: CHARACTER_WORLD_SCALE,
    behindBody: def.behind, overWeapon: false, shaded: def.shaded,
  };
}

function resolveShaftTargets(opts: {
  readonly facing: CardinalFacing; readonly rightDef: ShoulderDef;
  readonly p1: Point2D; readonly p2: Point2D;
}): { readonly right: Point2D; readonly left: Point2D } {
  const { facing, rightDef, p1, p2 } = opts;
  if (facing === "south" || facing === "north") {
    const [pMin, pMax] = p1.x <= p2.x ? [p1, p2] : [p2, p1];
    return rightDef.sideSign < 0 ? { right: pMin, left: pMax } : { right: pMax, left: pMin };
  }
  const [pFar, pNear] = Math.abs(p1.x) >= Math.abs(p2.x) ? [p1, p2] : [p2, p1];
  return facing === "west" ? { right: pFar, left: pNear } : { right: pNear, left: pFar };
}

function pulledSecondarySocket(grips: WeaponGripSockets, secondary: GripSocket, bowCharge: number): GripSocket {
  if (grips.twoHandStyle !== "bowDraw" || bowCharge <= 0) return secondary;
  return { ...secondary, x: secondary.x - bowCharge * 1.6 };
}

function resolveTwoHandArms(input: {
  readonly facing: CardinalFacing; readonly sy: number;
  readonly rightDef: ShoulderDef; readonly leftDef: ShoulderDef;
  readonly layout: HeldLayout; readonly grips: WeaponGripSockets; readonly secondary: GripSocket;
  readonly bowCharge: number;
}): ArmRigPose {
  const { facing, sy, rightDef, leftDef, layout, grips, secondary, bowCharge } = input;
  const p1 = transformWeaponSocket(layout.main, grips.primary);
  const p2 = transformWeaponSocket(layout.main, pulledSecondarySocket(grips, secondary, bowCharge));
  if (grips.twoHandStyle === "shaftTwoHand") {
    const targets = resolveShaftTargets({ facing, rightDef, p1, p2 });
    return {
      right: connectOrTuck({ facing, def: rightDef, sy, target: targets.right, behindBody: rightDef.behind, overWeapon: false }),
      left: connectOrTuck({ facing, def: leftDef, sy, target: targets.left, behindBody: leftDef.behind, overWeapon: false }),
    };
  }
  const swap = facing === "west";
  const rightOver = !swap && facing !== "north" && Boolean(secondary.overWeapon);
  const leftOver = swap && Boolean(secondary.overWeapon);
  return {
    right: connectOrTuck({ facing, def: rightDef, sy, target: swap ? p1 : p2, behindBody: rightDef.behind, overWeapon: rightOver }),
    left: connectOrTuck({ facing, def: leftDef, sy, target: swap ? p2 : p1, behindBody: leftDef.behind, overWeapon: leftOver }),
  };
}

function resolveLeftSingleArm(input: {
  readonly facing: CardinalFacing; readonly def: ShoulderDef; readonly sy: number;
  readonly pose: CharacterPose; readonly airborne: AirborneState; readonly layout: HeldLayout;
}): ArmPlacement {
  const { facing, def, sy, pose, airborne, layout } = input;
  if (layout.shield.equipped) {
    return connectOrTuck({ facing, def, sy, target: { x: layout.shield.x, y: layout.shield.y }, behindBody: layout.shield.behindBody, overWeapon: false });
  }
  if (layout.offhand.kind === "handLantern") {
    return connectOrTuck({ facing, def, sy, target: { x: layout.offhand.x, y: layout.offhand.y }, behindBody: layout.offhand.behindBody, overWeapon: false });
  }
  return hangingArm({ def, sy, facing, pose, airborne, isRight: false });
}

export function computeArmRig(input: {
  readonly facing: CardinalFacing;
  readonly female: boolean;
  readonly pose: CharacterPose;
  readonly airborneState: AirborneState;
  readonly grips: WeaponGripSockets | null;
  readonly layout: HeldLayout;
  readonly bowCharge?: number;
  readonly swinging?: boolean;
}): ArmRigPose {
  const { facing, female, pose, airborneState, grips, layout } = input;
  const sy = -10.3 + pose.bobY * CHARACTER_WORLD_SCALE;
  const { right: rightDef, left: leftDef } = shoulderPair(facing, female ? 3.5 : 4.2);
  if (grips?.secondary) {
    return resolveTwoHandArms({ facing, sy, rightDef, leftDef, layout, grips, secondary: grips.secondary, bowCharge: input.bowCharge ?? 0 });
  }
  const forceReach = Boolean(input.swinging);
  const right = grips
    ? connectOrTuck({ facing, def: rightDef, sy, target: transformWeaponSocket(layout.main, grips.primary), behindBody: layout.main.behindBody, overWeapon: Boolean(grips.primary.overWeapon), forceReach })
    : hangingArm({ def: rightDef, sy, facing, pose, airborne: airborneState, isRight: true });
  return {
    right,
    left: resolveLeftSingleArm({ facing, def: leftDef, sy, pose, airborne: airborneState, layout }),
  };
}
