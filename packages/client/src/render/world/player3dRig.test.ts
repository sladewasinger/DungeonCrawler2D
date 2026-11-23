import { DEFAULT_APPEARANCE, type PlayerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { IDLE_POSES, resolveFacingDir8, type DirectionAnim } from "../character/characterTypes.js";
import { computeActorCombatFx } from "../character/heldPlacement.js";
import { remapSentinelPixel, remapSentinelPixelAt, resolveLayerStack, resolveSentinelPalettes, type SentinelPalettes } from "../character/playerCompositor.js";
import { getPoseTuning, resetPoseTuning } from "../poseTuning/poseTuningStore.js";
import { computePoseFrameIdx, gearLayoutFor, resolvePlayerFacing, resolvePoseSnapshot, resolvePoseTrack, syncBowAimGuide, type ActivePose } from "./playerPoseHelpers.js";

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

describe("3D orbit carry, vertical bow aim, facing & clip tracks", () => {
  const mkActive = (dir: "south" | "se" | "side" | "ne" | "north", facing: "east" | "north" | "south" | "west", flipX: boolean): ActivePose => ({
    facing, dir, flipX, clip: "idle", frameIdx: 0, pose: IDLE_POSES[0]!, airborne: "ground",
  });
  const mkVis = (aimMode: "meleeCarry" | "aim360") => ({
    texture: null as never, anchorX: 0.23, anchorY: 0.5, aimMode,
    twoHanded: aimMode === "aim360", grips: { primary: { x: 0, y: 0, showHand: true } }, spriteScale: 0.3333,
  });

  it("orbits sword and lantern across SE, East, NE and keeps NW sword mirrored", () => {
    const snap = makeTestSnap({ heldItem: "sword", torchLit: true });
    const se = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("se", "east", false) });
    const east = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("side", "east", false) });
    const ne = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("ne", "east", false) });
    expect(se.main.x).not.toBeCloseTo(east.main.x, 1);
    expect(east.main.x).not.toBeCloseTo(ne.main.x, 1);
    expect(se.offhand.x).not.toBeCloseTo(east.offhand.x, 1);
    expect(east.offhand.x).not.toBeCloseTo(ne.offhand.x, 1);

    const swipeSnap = makeTestSnap({ heldItem: "sword", facingX: 1, facingY: 0, aimX: 1, aimY: 0, swingProgress: 0.85, comboStep: 2 });
    const eastSwipe = gearLayoutFor({ snap: swipeSnap, visual: mkVis("meleeCarry"), timeSec: 0.2, is3d: true, active: mkActive("side", "east", false) });
    expect(eastSwipe.main.behindBody).toBe(false);

    const nwSword = gearLayoutFor({
      snap: makeTestSnap({ heldItem: "sword", facingX: -0.7, facingY: -0.7 }),
      visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("ne", "west", true),
    });
    expect(nwSword.main.scaleX).toBeLessThan(0);
    expect(nwSword.main.rotation).toBeGreaterThan(0);
  });

  it("holds bow vertically across all 8 dirs, clamps slight aim tilt, and orders north/ne/nw behind", () => {
    const bowVis = mkVis("aim360");
    const cases: readonly { readonly active: ActivePose; readonly aimX: number; readonly aimY: number; readonly signX: 1 | -1; readonly behind: boolean }[] = [
      { active: mkActive("south", "south", false), aimX: 0, aimY: 1, signX: 1, behind: false },
      { active: mkActive("se", "east", false), aimX: 0.7, aimY: 0.7, signX: 1, behind: false },
      { active: mkActive("side", "east", false), aimX: 1, aimY: 0, signX: 1, behind: false },
      { active: mkActive("ne", "east", false), aimX: 0.7, aimY: -0.7, signX: 1, behind: true },
      { active: mkActive("north", "north", false), aimX: 0, aimY: -1, signX: -1, behind: true },
      { active: mkActive("ne", "west", true), aimX: -0.7, aimY: -0.7, signX: -1, behind: true },
      { active: mkActive("side", "west", true), aimX: -1, aimY: 0, signX: -1, behind: false },
      { active: mkActive("se", "west", true), aimX: -0.7, aimY: 0.7, signX: -1, behind: false },
    ];
    for (const c of cases) {
      const snap = makeTestSnap({ heldItem: "bow", aimX: c.aimX, aimY: c.aimY, facingX: c.aimX, facingY: c.aimY });
      const laid = gearLayoutFor({ snap, visual: bowVis, timeSec: 0, is3d: true, active: c.active });
      expect(laid.main.scaleY).toBeGreaterThan(0);
      expect(Math.sign(laid.main.scaleX)).toBe(c.signX);
      expect(Math.abs(laid.main.rotation)).toBeLessThanOrEqual(0.48);
      expect(laid.main.behindBody).toBe(c.behind);
    }

    const eastUp = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: 0.92, aimY: -0.39 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "east", false) });
    const eastDown = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: 0.92, aimY: 0.39 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "east", false) });
    expect(eastUp.main.rotation).toBeLessThan(0);
    expect(eastDown.main.rotation).toBeGreaterThan(0);

    const westUp = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: -0.92, aimY: -0.39 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "west", true) });
    const westDown = gearLayoutFor({ snap: makeTestSnap({ heldItem: "bow", aimX: -0.92, aimY: 0.39 }), visual: bowVis, timeSec: 0, is3d: true, active: mkActive("side", "west", true) });
    expect(westUp.main.rotation).toBeGreaterThan(0);
    expect(westDown.main.rotation).toBeLessThan(0);
  });

  it("maps bow clip tracks to bowCharge frames and aims facing while stationary or charging", () => {
    const tex3 = Array.from({ length: 3 }, (_, i) => i as never);
    const tex6 = Array.from({ length: 6 }, (_, i) => i as never);
    const anim = { idle: tex3, walk: tex6, run: tex6, jump: tex3, fall: tex3, bow: tex3 } as unknown as DirectionAnim;

    const stationaryBow = resolvePoseTrack({ anim, snap: makeTestSnap({ heldItem: "bow", bowCharge: 0 }), is3d: true });
    expect(stationaryBow.clip).toBe("bow");
    expect(computePoseFrameIdx({ track: stationaryBow, timeSec: 0, dodgeStartSec: null, bowCharge: 0 })).toBe(0);
    expect(computePoseFrameIdx({ track: stationaryBow, timeSec: 0, dodgeStartSec: null, bowCharge: 0.3 })).toBe(1);
    expect(computePoseFrameIdx({ track: stationaryBow, timeSec: 0, dodgeStartSec: null, bowCharge: 0.85 })).toBe(2);

    const movingNoCharge = resolvePoseTrack({ anim, snap: makeTestSnap({ heldItem: "bow", moving: true, bowCharge: 0 }), is3d: true });
    expect(movingNoCharge.clip).toBe("walk");

    const movingCharging = resolvePoseTrack({ anim, snap: makeTestSnap({ heldItem: "bow", moving: true, bowCharge: 0.4 }), is3d: true });
    expect(movingCharging.clip).toBe("bow");

    const faced = resolvePlayerFacing({
      snap: makeTestSnap({ heldItem: "bow", facingX: 0, facingY: 1, aimX: 1, aimY: 0 }),
      is3d: true,
      prev: { dir: "south", flipX: false },
    });
    expect(faced).toEqual({ dir: "side", flipX: false });
  });

  it("applies live per-body poseTuning overrides to sword carry layout", () => {
    try {
      const fTune = getPoseTuning("female");
      fTune.sword[0]!.x = -5.9;
      const snap = makeTestSnap({ heldItem: "sword", torchLit: false, appearance: { ...DEFAULT_APPEARANCE, body: "female" } });
      const layout = gearLayoutFor({ snap, visual: mkVis("meleeCarry"), timeSec: 0, is3d: true, active: mkActive("south", "south", false) });
      expect(layout.main.x).toBeCloseTo(-5.9, 4);
    } finally {
      resetPoseTuning();
    }
  });

  it("selects calm 7 fps walk clip when moving normally and 11 fps run clip when sprinting", () => {
    const tex6 = Array.from({ length: 6 }, (_, i) => i as never);
    const anim = { idle: [0 as never], walk: tex6, run: tex6, jump: [], fall: [] } as unknown as DirectionAnim;
    const facing = { dir: "south" as const, flipX: false };
    const walkTrack = resolvePoseTrack({ anim, snap: makeTestSnap({ moving: true, sprinting: false }), is3d: true });
    expect(walkTrack).toMatchObject({ clip: "walk", fps: 7 });
    const sprintTrack = resolvePoseTrack({ anim, snap: makeTestSnap({ moving: true, sprinting: true }), is3d: true });
    expect(sprintTrack).toMatchObject({ clip: "run", fps: 11 });
    expect(computePoseFrameIdx({ track: walkTrack, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.25 })).toBe(1);
    expect(computePoseFrameIdx({ track: walkTrack, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.75 })).toBe(4);
    expect(resolvePoseSnapshot({ anim, facing, snap: makeTestSnap({ moving: true, sprinting: true }), is3d: true, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.25 }).active.frameIdx).toBe(1);
    expect(resolvePoseSnapshot({ anim, facing, snap: makeTestSnap({ moving: true, sprinting: true }), is3d: true, timeSec: 0, dodgeStartSec: null, gaitPhase: 0.75 }).active.frameIdx).toBe(4);
  });

  it("supports swim track, data-driven armless/full-arm stacks, and two-tone gradient hair", () => {
    const tex4 = Array.from({ length: 4 }, (_, i) => i as never);
    const anim = { idle: tex4, walk: tex4, run: tex4, jump: tex4, fall: tex4, swim: tex4 } as unknown as DirectionAnim;
    expect(resolvePoseTrack({ anim, snap: makeTestSnap({ inDeepWater: true }), is3d: true }).clip).toBe("swim");
    const kit = { head: null, chest: "leather-tunic", legs: "leather-leggings", feet: "leather-boots", offhand: null };
    const full = resolveLayerStack(DEFAULT_APPEARANCE, kit, true);
    const armless = resolveLayerStack(DEFAULT_APPEARANCE, kit, false);
    expect(full).toEqual(expect.arrayContaining(["body-male-arms", "armor-chest-sleeves-male", "hair-short"]));
    expect(armless).not.toContain("body-male-arms");
    expect(armless).not.toContain("armor-chest-sleeves-male");
    const hooded = resolveLayerStack(DEFAULT_APPEARANCE, { ...kit, head: "leather-hood" }, true);
    expect(hooded).toContain("armor-head-leather-hood");
    expect(hooded).not.toContain("hair-short");
    const gradPal = resolveSentinelPalettes({ ...DEFAULT_APPEARANCE, hairColor: "pink-purple" });
    expect(remapSentinelPixelAt([40, 210, 0], gradPal, 0.0)).toEqual(gradPal.hair.base);
    expect(remapSentinelPixelAt([40, 210, 0], gradPal, 1.0)).toEqual(gradPal.hairTip?.base);
  });

  it("draws the subtle dashed bow aim guide only when holding the bow", () => {
    let drawn = false;
    const fakeG = {
      visible: false,
      clear() { return this; },
      moveTo() { drawn = true; return this; },
      lineTo() { return this; },
      stroke() { return this; },
      circle() { return this; },
      fill() { return this; },
    } as never;
    syncBowAimGuide(fakeG, makeTestSnap({ heldItem: "sword", aimX: 1, aimY: 0 }), false);
    expect((fakeG as { visible: boolean }).visible).toBe(false);
    syncBowAimGuide(fakeG, makeTestSnap({ heldItem: "bow", aimX: 1, aimY: 0, bowCharge: 0.8 }), false);
    expect((fakeG as { visible: boolean }).visible).toBe(true);
    expect(drawn).toBe(true);
  });
});
