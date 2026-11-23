import { DEFAULT_APPEARANCE, type PlayerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { IDLE_POSES, resolveFacingDir8, type DirectionAnim } from "../character/characterTypes.js";
import { computeActorCombatFx } from "../character/heldPlacement.js";
import { remapSentinelPixel, type SentinelPalettes } from "../character/playerCompositor.js";
import { getPoseTuning, resetPoseTuning } from "../poseTuning/poseTuningStore.js";
import { computeTwoSegmentArmRig, solveTwoBoneIk } from "./playerArmIk.js";
import { computePoseFrameIdx, gearLayoutFor, resolvePoseSnapshot, resolvePoseTrack, type ActivePose } from "./playerPoseHelpers.js";

function makeTestSnap(overrides?: Partial<PlayerSnapshot>): PlayerSnapshot {
  return {
    id: "p1", name: "Austin", x: 0, y: 0, elevation: 0, facingX: 0, facingY: 1,
    moving: false, torchLit: true, inWater: false, lastAckSeq: 0, ...overrides,
  };
}

const SAMPLE_PALETTE: SentinelPalettes = {
  skin: { shade: [160, 110, 75], base: [220, 170, 125], highlight: [248, 204, 164] },
  iris: { shade: [20, 70, 130], base: [50, 130, 210], highlight: [110, 180, 250] },
  hair: { shade: [120, 35, 25], base: [180, 60, 35], highlight: [225, 100, 60] },
};

describe("solveTwoBoneIk", () => {
  it("preserves exact bone lengths for reachable targets and respects bendSign", () => {
    const pos = solveTwoBoneIk({ sx: 0, sy: 0, tx: 2.4, ty: 3.2, l1: 2.8, l2: 2.9, bendSign: 1 });
    const neg = solveTwoBoneIk({ sx: 0, sy: 0, tx: 2.4, ty: 3.2, l1: 2.8, l2: 2.9, bendSign: -1 });
    expect(pos.stretch).toBe(1);
    expect(Math.hypot(pos.ex - pos.sx, pos.ey - pos.sy)).toBeCloseTo(2.8, 4);
    expect(Math.hypot(2.4 - pos.ex, 3.2 - pos.ey)).toBeCloseTo(2.9, 4);
    expect(Math.hypot(neg.ex - neg.sx, neg.ey - neg.sy)).toBeCloseTo(2.8, 4);
    expect(pos.ey).not.toBeCloseTo(neg.ey, 2);
  });

  it("clamps zero-distance without NaN and caps over-reach stretch at 1.28", () => {
    const zero = solveTwoBoneIk({ sx: 2, sy: -10, tx: 2, ty: -10, l1: 2.8, l2: 2.9, bendSign: 1 });
    expect(Number.isFinite(zero.ex)).toBe(true);
    expect(Number.isFinite(zero.upperAngle)).toBe(true);

    const far = solveTwoBoneIk({ sx: 0, sy: 0, tx: 20, ty: 0, l1: 2.8, l2: 2.9, bendSign: 1 });
    expect(far.stretch).toBeCloseTo(1.32, 4);
    expect(far.upperAngle).toBeCloseTo(0, 4);
    expect(far.foreAngle).toBeCloseTo(0, 4);

    const sleek = solveTwoBoneIk({ sx: 0, sy: 0, tx: 0, ty: 3.5, l1: 2.8, l2: 2.9, bendSign: 1, maxBendRad: 0.22 });
    expect(Math.abs(sleek.ex)).toBeLessThan(0.8);
    expect(Math.hypot(0 - (sleek.ex + Math.cos(sleek.foreAngle) * 2.9 * sleek.stretch), 3.5 - (sleek.ey + Math.sin(sleek.foreAngle) * 2.9 * sleek.stretch))).toBeLessThan(0.05);
  });
});

describe("remapSentinelPixel", () => {
  it("maps skin, iris, and hair sentinel chroma bands while sparing neutral armor/whites", () => {
    expect(remapSentinelPixel([255, 0, 140], SAMPLE_PALETTE)).toEqual(SAMPLE_PALETTE.skin.highlight);
    expect(remapSentinelPixel([210, 0, 110], SAMPLE_PALETTE)).toEqual(SAMPLE_PALETTE.skin.base);
    expect(remapSentinelPixel([0, 200, 220], SAMPLE_PALETTE)).toEqual(SAMPLE_PALETTE.iris.base);
    expect(remapSentinelPixel([40, 210, 0], SAMPLE_PALETTE)).toEqual(SAMPLE_PALETTE.hair.base);

    expect(remapSentinelPixel([142, 64, 30], SAMPLE_PALETTE)).toBeNull();
    expect(remapSentinelPixel([248, 250, 252], SAMPLE_PALETTE)).toBeNull();
    expect(remapSentinelPixel([217, 119, 6], SAMPLE_PALETTE)).toBeNull();
  });
});

describe("resolveFacingDir8", () => {
  it("maps all 8 compass sectors cleanly and applies boundary hysteresis", () => {
    expect(resolveFacingDir8(0, 1)).toEqual({ dir: "south", flipX: false });
    expect(resolveFacingDir8(0.7, 0.7)).toEqual({ dir: "se", flipX: false });
    expect(resolveFacingDir8(-0.7, 0.7)).toEqual({ dir: "se", flipX: true });
    expect(resolveFacingDir8(1, 0)).toEqual({ dir: "side", flipX: false });
    expect(resolveFacingDir8(-1, 0)).toEqual({ dir: "side", flipX: true });
    expect(resolveFacingDir8(0.7, -0.7)).toEqual({ dir: "ne", flipX: false });
    expect(resolveFacingDir8(-0.7, -0.7)).toEqual({ dir: "ne", flipX: true });
    expect(resolveFacingDir8(0, -1)).toEqual({ dir: "north", flipX: false });

    const prev = { dir: "se" as const, flipX: false };
    const edge = resolveFacingDir8(Math.cos((21 * Math.PI) / 180), Math.sin((21 * Math.PI) / 180), prev);
    expect(edge.dir).toBe("se");
  });
});

describe("computeActorCombatFx is3d mode", () => {
  it("skips legacy 90-degree downed and dodge tilt when 3D sprites handle those poses", () => {
    const downed = computeActorCombatFx({
      aimX: 0, aimY: 1, facingX: 1, swingProgress: 0, comboStep: 1,
      dodging: false, staggered: false, downed: true, is3d: true,
    });
    expect(downed.rot).toBe(0);
    expect(downed.y).toBe(0);

    const dodge = computeActorCombatFx({
      aimX: 0, aimY: 1, facingX: 1, swingProgress: 0, comboStep: 1,
      dodging: true, staggered: false, is3d: true,
    });
    expect(dodge.rot).toBe(0);
    expect(dodge.alpha).toBeCloseTo(0.62, 2);

    const invulnA = computeActorCombatFx({
      aimX: 0, aimY: 1, facingX: 1, swingProgress: 0, comboStep: 1,
      dodging: false, invulnTimer: 0.3, staggered: false, timeSec: 0, is3d: true,
    });
    const invulnB = computeActorCombatFx({
      aimX: 0, aimY: 1, facingX: 1, swingProgress: 0, comboStep: 1,
      dodging: false, invulnTimer: 0.3, staggered: false, timeSec: 0.05, is3d: true,
    });
    expect(invulnA.alpha).toBeCloseTo(0.48, 2);
    expect(invulnB.alpha).toBeCloseTo(0.96, 2);
  });
});

describe("3D orbit carry, bow reach, free hands & north/south depth", () => {
  const mkActive = (dir: "south" | "se" | "side" | "ne" | "north", facing: "east" | "north" | "south" | "west", flipX: boolean): ActivePose => ({
    facing, dir, flipX, clip: "idle", frameIdx: 0, pose: IDLE_POSES[0]!, airborne: "ground",
  });
  const mkVis = (aimMode: "meleeCarry" | "aim360") => ({
    texture: null as never, anchorX: 0.23, anchorY: 0.5, aimMode,
    twoHanded: aimMode === "aim360", grips: { primary: { x: 0, y: 0, showHand: true } }, spriteScale: 0.3333,
  });

  it("orbits sword and lantern across SE, East, NE and stabilizes north/south shading & free hands", () => {
    const snap = makeTestSnap({ heldItem: "sword", torchLit: true });
    const se = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("se", "east", false) });
    const east = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("side", "east", false) });
    const ne = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("ne", "east", false) });
    expect(se.main.x).not.toBeCloseTo(east.main.x, 1);
    expect(east.main.x).not.toBeCloseTo(ne.main.x, 1);
    expect(se.offhand.x).not.toBeCloseTo(east.offhand.x, 1);
    expect(east.offhand.x).not.toBeCloseTo(ne.offhand.x, 1);

    const tune = getPoseTuning("male");
    const rigNorth = computeTwoSegmentArmRig({
      sockets: { right: { x: 2.75, y: -12.54, behind: false }, left: { x: -2.75, y: -12.54, behind: false } },
      dir: "north", flipX: false, layout: gearLayoutFor({ snap: makeTestSnap({ torchLit: false }), visual: null, timeSec: 0, is3d: true, active: mkActive("north", "north", false) }),
      grips: null, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 0,
    });
    expect(rigNorth.right.behindBody).toBe(tune.freeRight[4]!.foreBehind);
    expect(rigNorth.right.handBehind).toBe(tune.freeRight[4]!.handBehind);
    expect(rigNorth.right.shaded).toBe(tune.freeRight[4]!.shaded);
    expect(rigNorth.right.ik.ex).toBeGreaterThan(rigNorth.right.ik.sx);
    expect(rigNorth.left.upperBehind).toBe(tune.freeLeft[4]!.upperBehind);
    expect(rigNorth.left.behindBody).toBe(tune.freeLeft[4]!.foreBehind);
    expect(rigNorth.left.handBehind).toBe(tune.freeLeft[4]!.handBehind);
    expect(rigNorth.left.shaded).toBe(tune.freeLeft[4]!.shaded);
    expect(rigNorth.left.taper).toBe(tune.freeLeft[4]!.taper);
    expect(rigNorth.left.showFreeHand).toBe(true);
    expect(rigNorth.left.ik.ex).toBeLessThan(rigNorth.left.ik.sx);

    const rigSouthEmpty = computeTwoSegmentArmRig({
      sockets: { right: { x: -2.75, y: -12.54, behind: false }, left: { x: 2.75, y: -12.54, behind: false } },
      dir: "south", flipX: false, layout: gearLayoutFor({ snap: makeTestSnap({ torchLit: false }), visual: null, timeSec: 0, is3d: true, active: mkActive("south", "south", false) }),
      grips: null, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 0,
    });
    expect(rigSouthEmpty.left.upperBehind).toBe(tune.freeLeft[0]!.upperBehind);
    expect(rigSouthEmpty.left.behindBody).toBe(tune.freeLeft[0]!.foreBehind);
    expect(rigSouthEmpty.left.handBehind).toBe(tune.freeLeft[0]!.handBehind);
    expect(rigSouthEmpty.left.shaded).toBe(tune.freeLeft[0]!.shaded);
    expect(rigSouthEmpty.left.taper).toBe(tune.freeLeft[0]!.taper);
    expect(rigSouthEmpty.left.ik.sx).toBeCloseTo(2.75 + tune.freeLeft[0]!.sxOff, 4);
    expect(rigSouthEmpty.left.ik.ex).toBeGreaterThan(rigSouthEmpty.left.ik.sx);
    expect(rigSouthEmpty.right.ik.sx).toBeCloseTo(-(2.75 + tune.freeRight[0]!.sxOff), 4);
  });

  it("outstretches the bow arm, draws north/ne bows behind torso, and keeps East/West bows & swipe in front", () => {
    const bowSnap = makeTestSnap({ heldItem: "bow", torchLit: false, facingX: 0, facingY: -1, aimX: 0, aimY: -1, bowCharge: 1 });
    const bowVis = mkVis("aim360");
    const bowGrips = { primary: { x: 0, y: 0, showHand: true }, secondary: { x: -9, y: 0, showHand: true, overWeapon: true }, twoHandStyle: "bowDraw" as const };
    const northBow = gearLayoutFor({ snap: bowSnap, visual: bowVis, timeSec: 0, is3d: true, active: mkActive("north", "north", false) });
    expect(northBow.main.behindBody).toBe(true);
    const eastBow = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: 1, aimY: 0, facingX: 1, facingY: 0 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "east", false) });
    expect(eastBow.main.x).toBeGreaterThanOrEqual(6.5);

    const eastUpBow = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: 0.92, aimY: -0.39, facingX: 1, facingY: 0 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "east", false) });
    expect(eastUpBow.main.behindBody).toBe(false);
    const rigEastUpBow = computeTwoSegmentArmRig({
      sockets: { right: { x: -0.17, y: -12.26, behind: false }, left: { x: -0.17, y: -16.2, behind: true } },
      dir: "side", flipX: false, layout: eastUpBow, grips: bowGrips, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 1,
    });
    expect(rigEastUpBow.right.behindBody).toBe(false);

    const westUpBow = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: -0.92, aimY: -0.39, facingX: -1, facingY: 0 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "west", true) });
    expect(westUpBow.main.behindBody).toBe(false);
    const rigWestUpBow = computeTwoSegmentArmRig({
      sockets: { right: { x: 0.17, y: -16.2, behind: true }, left: { x: 0.17, y: -12.26, behind: false } },
      dir: "side", flipX: true, layout: westUpBow, grips: bowGrips, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 1,
    });
    expect(rigWestUpBow.left.behindBody).toBe(false);

    const neBow = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: 0.7, aimY: -0.7, facingX: 0.7, facingY: -0.7 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("ne", "east", false) });
    expect(neBow.main.behindBody).toBe(true);

    const rigBow = computeTwoSegmentArmRig({
      sockets: { right: { x: 2.75, y: -12.54, behind: false }, left: { x: -2.75, y: -12.54, behind: false } },
      dir: "north", flipX: false, layout: northBow, grips: bowGrips, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 1,
    });
    expect(rigBow.right.behindBody).toBe(true);
    expect(rigBow.left.behindBody).toBe(true);
    expect(rigBow.left.showFreeHand).toBe(false);

    const swipeSnap = makeTestSnap({ heldItem: "sword", facingX: 1, facingY: 0, aimX: 1, aimY: 0, swingProgress: 0.85, comboStep: 2 });
    const eastSwipe = gearLayoutFor({ snap: swipeSnap, visual: mkVis("meleeCarry"), timeSec: 0.2, is3d: true, active: mkActive("side", "east", false) });
    expect(eastSwipe.main.behindBody).toBe(false);
    const rigSwipe = computeTwoSegmentArmRig({
      sockets: { right: { x: -0.17, y: -12.26, behind: false }, left: { x: -0.17, y: -16.2, behind: true } },
      dir: "side", flipX: false, layout: eastSwipe, grips: { primary: { x: 0, y: 0, showHand: true } },
      pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 0,
    });
    expect(rigSwipe.right.behindBody).toBe(false);
  });

  it("bends side-view elbows backward anatomically when walking or running East and West", () => {
    const emptyLayout = gearLayoutFor({ snap: makeTestSnap({ torchLit: false }), visual: null, timeSec: 0, is3d: true, active: mkActive("side", "west", true) });
    const westRun = computeTwoSegmentArmRig({
      sockets: { right: { x: -0.6, y: -16.0, behind: true }, left: { x: -0.6, y: -12.1, behind: false } },
      dir: "side", flipX: true, layout: emptyLayout, grips: null, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 0,
    });
    expect(westRun.left.ik.ex).toBeGreaterThan(westRun.left.ik.sx);

    const eastRun = computeTwoSegmentArmRig({
      sockets: { right: { x: 0.6, y: -12.1, behind: false }, left: { x: 0.6, y: -16.0, behind: true } },
      dir: "side", flipX: false, layout: emptyLayout, grips: null, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 0,
    });
    expect(eastRun.right.ik.ex).toBeLessThan(eastRun.right.ik.sx);

    const nwSword = gearLayoutFor({
      snap: makeTestSnap({ heldItem: "sword", facingX: -0.7, facingY: -0.7 }),
      visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("ne", "west", true),
    });
    expect(nwSword.main.scaleX).toBeLessThan(0);
    expect(nwSword.main.rotation).toBeGreaterThan(0);
  });

  it("applies live per-body poseTuning overrides across sword layout and free-arm depth", () => {
    try {
      const fTune = getPoseTuning("female");
      fTune.sword[0]!.x = -5.9;
      fTune.freeLeft[0]!.upperBehind = true;
      const snap = makeTestSnap({ heldItem: "sword", torchLit: false, appearance: { ...DEFAULT_APPEARANCE, body: "female" } });
      const layout = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("south", "south", false) });
      expect(layout.main.x).toBeCloseTo(-5.9, 4);
      const rig = computeTwoSegmentArmRig({
        sockets: { right: { x: -2.75, y: -12.54, behind: false }, left: { x: 2.75, y: -12.54, behind: false } },
        dir: "south", flipX: false, layout, grips: null, pose: IDLE_POSES[0]!, airborne: "ground", bowCharge: 0, body: "female",
      });
      expect(rig.left.upperBehind).toBe(true);
    } finally {
      resetPoseTuning();
    }
  });

  it("selects calm 7 fps walk clip when moving normally and 11 fps run clip when sprinting", () => {
    const tex6 = Array.from({ length: 6 }, (_, i) => i as never);
    const anim = { idle: [0 as never], walk: tex6, run: tex6, jump: [], fall: [] } as unknown as DirectionAnim;
    const facing = { dir: "south" as const, flipX: false };
    const walkTrack = resolvePoseTrack({ anim, snap: makeTestSnap({ moving: true, sprinting: false }), is3d: true });
    expect(walkTrack.clip).toBe("walk");
    expect(walkTrack.fps).toBe(7);

    const sprintTrack = resolvePoseTrack({ anim, snap: makeTestSnap({ moving: true, sprinting: true }), is3d: true });
    expect(sprintTrack.clip).toBe("run");
    expect(sprintTrack.fps).toBe(11);

    expect(computePoseFrameIdx({ track: walkTrack, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.25 })).toBe(1);
    expect(computePoseFrameIdx({ track: walkTrack, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.75 })).toBe(4);
    expect(resolvePoseSnapshot({ anim, facing, snap: makeTestSnap({ moving: true, sprinting: true }), is3d: true, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.25 }).active.frameIdx).toBe(1);
    expect(resolvePoseSnapshot({ anim, facing, snap: makeTestSnap({ moving: true, sprinting: true }), is3d: true, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.75 }).active.frameIdx).toBe(4);
  });
});
