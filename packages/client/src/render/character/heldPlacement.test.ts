import { BODY_STYLES, EYE_COLORS, HAIR_STYLES, type ArmorEquipment, type CharacterAppearance } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { PixelRect } from "../textures/pixelCanvas.js";
import { armCanvasSize, buildArmRects, computeArmRig } from "./armRig.js";
import { buildArmorRects } from "./characterArmorLayers.js";
import { buildBodyRects } from "./characterBodyLayers.js";
import { buildHairRects } from "./characterHairLayers.js";
import {
  CHARACTER_WORLD_SCALE, FALL_POSES, IDLE_POSES, JUMP_POSES, RUN_POSES, resolveFacingDir,
  type FacingDir,
} from "./characterTypes.js";
import { computeHeldLayout } from "./heldPlacement.js";
import type { WeaponGripSockets } from "./heldWeapons.js";

const SWORD_GRIPS: WeaponGripSockets = { primary: { x: 0, y: 0, showHand: true } };
const BOW_GRIPS: WeaponGripSockets = {
  primary: { x: 0, y: 0, showHand: true },
  secondary: { x: -4, y: 0, showHand: true, overWeapon: true },
  twoHandStyle: "bowDraw",
};
const STAFF_GRIPS: WeaponGripSockets = {
  primary: { x: 4, y: 0, showHand: true },
  secondary: { x: -4, y: 0, showHand: true },
  twoHandStyle: "shaftTwoHand",
};
const GREATSWORD_GRIPS: WeaponGripSockets = {
  primary: { x: 0, y: 0, showHand: true },
  secondary: { x: -4, y: 0, showHand: true },
  twoHandStyle: "shaftTwoHand",
};

describe("resolveFacingDir", () => {
  it("maps aim vectors to south, north, east, and west mirrored side facings", () => {
    expect(resolveFacingDir(0, 1)).toEqual({ dir: "south", flipX: false });
    expect(resolveFacingDir(0, -1)).toEqual({ dir: "north", flipX: false });
    expect(resolveFacingDir(1, 0)).toEqual({ dir: "side", flipX: false });
    expect(resolveFacingDir(-1, 0)).toEqual({ dir: "side", flipX: true });
    expect(resolveFacingDir(0, 0)).toEqual({ dir: "south", flipX: false });
  });
});

describe("computeHeldLayout", () => {
  it("keeps sword in dominant right hand and torch in left hand across south mouse sweeps", () => {
    const southLeft = computeHeldLayout({
      aimX: -0.2, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    const southRight = computeHeldLayout({
      aimX: 0.2, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(southLeft.main.x).toBeLessThan(0);
    expect(southRight.main.x).toBeLessThan(0);
    expect(southLeft.offhand.x).toBeGreaterThan(0);
    expect(southRight.offhand.x).toBeGreaterThan(0);
    expect(southLeft.main.behindBody).toBe(false);
    expect(southLeft.offhand.behindBody).toBe(false);
  });

  it("flips dominant right/left hand positions cleanly when facing north, east, and west", () => {
    const north = computeHeldLayout({
      aimX: 0, aimY: -1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(north.main.x).toBeGreaterThan(0);
    expect(north.main.behindBody).toBe(true);
    expect(north.offhand.x).toBeLessThan(0);
    expect(north.offhand.behindBody).toBe(true);

    const east = computeHeldLayout({
      aimX: 1, aimY: 0, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(east.main.behindBody).toBe(false);
    expect(east.offhand.kind).toBe("handLantern");
    expect(east.offhand.x).toBeGreaterThan(4);
    expect(east.offhand.behindBody).toBe(true);

    const west = computeHeldLayout({
      aimX: -1, aimY: 0, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(west.offhand.kind).toBe("handLantern");
    expect(west.offhand.behindBody).toBe(false);
    expect(west.main.x).toBeLessThan(-4);
    expect(west.main.behindBody).toBe(true);
  });

  it("aims bow 360 degrees with left-hip waist lantern and suppresses duplicate held lantern when holding torch", () => {
    const bowWest = computeHeldLayout({
      aimX: -1, aimY: 0.1, heldItem: "bow", torchLit: true, twoHanded: true, aimMode: "aim360", timeSec: 0, moving: false,
    });
    expect(bowWest.offhand.kind).toBe("hipLantern");
    expect(bowWest.offhand.x).toBeLessThan(0);
    expect(bowWest.offhand.behindBody).toBe(false);
    expect(bowWest.main.scaleY).toBe(-CHARACTER_WORLD_SCALE);

    const heldTorch = computeHeldLayout({
      aimX: 1, aimY: 0, heldItem: "torch", torchLit: true, twoHanded: false, aimMode: "upright", timeSec: 0, moving: false,
    });
    expect(heldTorch.offhand.kind).toBe("none");
    expect(heldTorch.main.x).toBeGreaterThan(0);
  });

  it("extends connected arms on side views, tucks cleanly on front/back camera aims, and adapts to staves/2H swords", () => {
    const pose = IDLE_POSES[0]!;
    const bowEastLayout = computeHeldLayout({
      aimX: 1, aimY: 0, heldItem: "bow", torchLit: true, twoHanded: true, aimMode: "aim360", timeSec: 0, moving: false,
    });
    const rigEast = computeArmRig({
      facing: "east", female: false, pose, airborneState: "ground", grips: BOW_GRIPS, layout: bowEastLayout,
    });
    expect(Math.abs(rigEast.right.rotation - Math.PI / 2)).toBeGreaterThan(0.5);
    expect(Math.abs(rigEast.left.rotation - Math.PI / 2)).toBeGreaterThan(0.5);
    expect(rigEast.right.overWeapon).toBe(true);
    expect(rigEast.left.behindBody).toBe(true);

    const bowWestLayout = computeHeldLayout({
      aimX: -1, aimY: 0, heldItem: "bow", torchLit: true, twoHanded: true, aimMode: "aim360", timeSec: 0, moving: false,
    });
    const rigWest = computeArmRig({
      facing: "west", female: true, pose, airborneState: "ground", grips: BOW_GRIPS, layout: bowWestLayout,
    });
    expect(Math.abs(rigWest.right.rotation - Math.PI / 2)).toBeGreaterThan(0.5);
    expect(rigWest.left.overWeapon).toBe(true);
    expect(rigWest.right.behindBody).toBe(true);

    const bowSouth = computeArmRig({
      facing: "south", female: true, pose, airborneState: "ground", grips: BOW_GRIPS,
      layout: computeHeldLayout({ aimX: 0, aimY: 1, heldItem: "bow", torchLit: true, twoHanded: true, aimMode: "aim360", timeSec: 0, moving: false }),
    });
    expect(bowSouth.right.rotation).toBeCloseTo(Math.PI / 2, 4);
    expect(bowSouth.left.rotation).toBeCloseTo(Math.PI / 2, 4);
    expect(bowSouth.right.scaleX).toBeLessThan(0.45);
    expect(bowSouth.left.scaleX).toBeLessThan(0.45);

    const rigSword = computeArmRig({
      facing: "south", female: false, pose, airborneState: "ground", grips: SWORD_GRIPS,
      layout: computeHeldLayout({ aimX: 0, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false }),
    });
    expect(rigSword.right.rotation).toBeGreaterThan(Math.PI / 2);
    expect(rigSword.left.rotation).toBeLessThan(Math.PI / 2);

    const noShield = { equipped: false, x: 0, y: 0, rotation: 0, scaleX: CHARACTER_WORLD_SCALE, behindBody: false };
    const staffRig = computeArmRig({
      facing: "south", female: false, pose, airborneState: "ground", grips: STAFF_GRIPS,
      layout: { main: { x: 0, y: -7.2, rotation: 0, scaleX: CHARACTER_WORLD_SCALE, scaleY: CHARACTER_WORLD_SCALE, behindBody: false }, offhand: { kind: "none", x: 0, y: 0, rotation: 0, behindBody: false }, shield: noShield },
    });
    expect(staffRig.right.scaleX).toBeGreaterThanOrEqual(0.45 * CHARACTER_WORLD_SCALE);
    expect(staffRig.left.scaleX).toBeGreaterThanOrEqual(0.45 * CHARACTER_WORLD_SCALE);
    expect(Math.abs(staffRig.right.rotation - Math.PI / 2)).toBeGreaterThan(0.1);
    expect(Math.abs(staffRig.left.rotation - Math.PI / 2)).toBeGreaterThan(0.1);

    const gsRig = computeArmRig({
      facing: "south", female: false, pose, airborneState: "ground", grips: GREATSWORD_GRIPS,
      layout: { main: { x: -4.2, y: -7.2, rotation: 0.9, scaleX: CHARACTER_WORLD_SCALE, scaleY: CHARACTER_WORLD_SCALE, behindBody: false }, offhand: { kind: "none", x: 0, y: 0, rotation: 0, behindBody: false }, shield: noShield },
    });
    expect(gsRig.right.scaleX).toBeGreaterThanOrEqual(0.45 * CHARACTER_WORLD_SCALE);

    const shieldLayout = computeHeldLayout({
      aimX: 0, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false, hasShield: true, blocking: false,
    });
    const blockingLayout = computeHeldLayout({
      aimX: 0, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false, hasShield: true, blocking: true,
    });
    expect(shieldLayout.shield.equipped).toBe(true);
    expect(shieldLayout.offhand.kind).toBe("hipLantern");
    expect(blockingLayout.shield.x).toBeLessThan(shieldLayout.shield.x);
    expect(blockingLayout.shield.y).toBeLessThan(shieldLayout.shield.y);
    const shieldRig = computeArmRig({
      facing: "south", female: false, pose, airborneState: "ground", grips: SWORD_GRIPS, layout: shieldLayout,
    });
    expect(shieldRig.left.rotation).toBeLessThan(Math.PI / 2);

    const swingLayout = computeHeldLayout({
      aimX: 0, aimY: 1, heldItem: "sword", torchLit: false, twoHanded: false, aimMode: "meleeCarry",
      timeSec: 0, moving: false, swingProgress: 0.5, comboStep: 1,
    });
    expect(Math.hypot(swingLayout.main.x, (swingLayout.main.y + 9.2) / 0.78)).toBeGreaterThan(7.5);
    const swingRig = computeArmRig({
      facing: "south", female: false, pose, airborneState: "ground", grips: SWORD_GRIPS, layout: swingLayout, swinging: true,
    });
    expect(swingRig.right.scaleX).toBeGreaterThanOrEqual(CHARACTER_WORLD_SCALE);

    const torchSwing = computeHeldLayout({
      aimX: 1, aimY: 0, heldItem: "torch", torchLit: true, twoHanded: false, aimMode: "upright",
      timeSec: 0, moving: false, swingProgress: 0.5, comboStep: 1,
    });
    expect(torchSwing.main.scaleY).toBeGreaterThan(0);
    expect(torchSwing.main.rotation).toBeGreaterThan(Math.PI * 0.25);
  });

  it("hangs free arms straight down at idle rest and never tilts inward during run, jump, or fall", () => {
    const idleLayout = computeHeldLayout({
      aimX: 0, aimY: 1, heldItem: null, torchLit: false, twoHanded: false, aimMode: "upright", timeSec: 0, moving: false,
    });
    for (const facing of ["south", "north", "east"] as const) {
      const rest = computeArmRig({ facing, female: false, pose: IDLE_POSES[0]!, airborneState: "ground", grips: null, layout: idleLayout });
      expect(rest.right.rotation).toBeCloseTo(Math.PI / 2, 4);
      expect(rest.left.rotation).toBeCloseTo(Math.PI / 2, 4);
    }
    for (const [poses, airborne] of [[RUN_POSES, "ground"], [JUMP_POSES, "jump"], [FALL_POSES, "fall"]] as const) {
      for (const pose of poses) {
        const s = computeArmRig({ facing: "south", female: true, pose, airborneState: airborne, grips: null, layout: idleLayout });
        expect(s.right.rotation).toBeGreaterThanOrEqual(Math.PI / 2 - 1e-6);
        expect(s.left.rotation).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
        const n = computeArmRig({ facing: "north", female: true, pose, airborneState: airborne, grips: null, layout: idleLayout });
        expect(n.right.rotation).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
        expect(n.left.rotation).toBeGreaterThanOrEqual(Math.PI / 2 - 1e-6);
      }
    }
  });
});

const TEST_DIRS: readonly FacingDir[] = ["south", "north", "side"];
const TEST_POSES = [...IDLE_POSES, ...RUN_POSES, ...JUMP_POSES, ...FALL_POSES];
const TEST_ARMOR_SETS: readonly ArmorEquipment[] = [
  { head: null, chest: null, legs: null, feet: null, offhand: null },
  { head: "leather-hood", chest: "leather-tunic", legs: "leather-leggings", feet: "leather-boots", offhand: null },
];

function collectFrameRects(appearance: CharacterAppearance, armor: ArmorEquipment, includeArms: boolean): PixelRect[] {
  return TEST_DIRS.flatMap((dir) =>
    TEST_POSES.flatMap((pose) => [
      ...buildBodyRects({ appearance, dir, pose, includeArms }),
      ...buildArmorRects({ appearance, armor, dir, pose, includeArms }),
      ...buildHairRects({ appearance, dir, pose, hooded: Boolean(armor.head) }),
    ]),
  );
}

function collectArmBoundsCases() {
  const look = (body: (typeof BODY_STYLES)[number]) => ({
    body, skin: "warm", eyeColor: "brown", hairStyle: "short", hairColor: "brown",
  }) as const;
  return BODY_STYLES.flatMap((body) =>
    TEST_ARMOR_SETS.flatMap((armor) => [false, true].map((shaded) => ({
      size: armCanvasSize(body === "female"),
      rects: buildArmRects({ appearance: look(body), armor, shaded }),
    }))),
  );
}

function findOutOfBoundsRect(rects: readonly PixelRect[], maxX: number, maxY: number): PixelRect | undefined {
  for (const rect of rects) {
    const [x, y, w, h] = rect;
    if (x < 1 || y < 1 || x + w > maxX || y + h > maxY) return rect;
  }
  return undefined;
}

describe("character sprite 32x32 outline-safe bounds", () => {
  it("keeps all body, armor, hair, and arm pixels inside outline-safe bounds across all poses and styles", () => {
    const looks = BODY_STYLES.flatMap((body) =>
      EYE_COLORS.flatMap((eyeColor) =>
        HAIR_STYLES.map((hairStyle) => ({ body, skin: "warm", eyeColor, hairStyle, hairColor: "red" }) as const),
      ),
    );
    for (const app of looks) {
      for (const armor of TEST_ARMOR_SETS) {
        expect(findOutOfBoundsRect(collectFrameRects(app, armor, false), 31, 29)).toBeUndefined();
        expect(findOutOfBoundsRect(collectFrameRects(app, armor, true), 31, 29)).toBeUndefined();
      }
    }
    for (const { size, rects: armRects } of collectArmBoundsCases()) {
      expect(findOutOfBoundsRect(armRects, size.w - 1, size.h - 1)).toBeUndefined();
    }
  });
});
