import { getItemDef, RECIPE_CATALOG } from "@dc2d/content";
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { nextCrouchState } from "../../../input/inputHelpers.js";
import { LocalSwingTracker } from "../../../net/localSwingTracker.js";
import { WEAPON_ITEM_PAINTERS } from "../../../ui/icons/weaponItemIcons.js";
import { canShowBackstabReticle } from "../aiStateIndicators.js";
import type { DirectionAnim } from "../../character/characterTypes.js";
import { getHeldWeaponVisual } from "../../character/heldWeapons.js";
import { computePoseFrameIdx, gearLayoutFor, resolvePoseTrack, resolveWeaponChargeTint } from "../../world/playerPoseHelpers.js";
import { resolveFeedbackEventCue } from "./combatFeedbackSpecs.js";
import { resolveWeaponSmearSpec } from "./weaponSmearDraw.js";

function makePlayer(overrides?: Partial<PlayerSnapshot>): PlayerSnapshot {
  return {
    id: "p1", name: "Austin", x: 10, y: 10, elevation: 0, facingX: 1, facingY: 0,
    moving: false, torchLit: false, inWater: false, lastAckSeq: 0, ...overrides,
  };
}

function makeEntity(overrides?: Partial<WorldEntitySnapshot>): WorldEntitySnapshot {
  return {
    id: "e1", kind: "goblin", x: 11.5, y: 10, elevation: 0, facingX: 1, facingY: 0,
    hp: 30, maxHp: 30, hitTimer: 0, staggerTimer: 0, bleedTimer: 0,
    telegraphProgress: 0, substance: "blood", aiState: "idle", ...overrides,
  };
}

const SWORD_ID = "sword";
const GREAT_ID = "iron-greatsword";

describe("Phase 6 & 7 client combat visuals, tracks, crouch modes & heavy prediction", () => {
  it("selects 3D crouch & per-phase attack frames and golden heavy charge blade pulse", () => {
    const tex = (n: number) => Array.from({ length: n }, (_, i) => i as never);
    const anim = { idle: tex(4), walk: tex(6), run: tex(6), jump: tex(2), fall: tex(2), crouchIdle: tex(4), crouchWalk: tex(6), attack: tex(3) } as unknown as DirectionAnim;
    expect(resolvePoseTrack({ anim, snap: makePlayer({ crouching: true, moving: false }), is3d: true }).clip).toBe("crouchIdle");
    expect(resolvePoseTrack({ anim, snap: makePlayer({ crouching: true, moving: true }), is3d: true }).clip).toBe("crouchWalk");

    const atkTrack = resolvePoseTrack({ anim, snap: makePlayer({ heldItem: "pickaxe", swingProgress: 0.2 }), is3d: true });
    expect(atkTrack.clip).toBe("attack");
    expect(computePoseFrameIdx({ track: atkTrack, timeSec: 0, dodgeStartSec: null, heldItem: SWORD_ID, swingProgress: 0.1 })).toBe(0);
    expect(computePoseFrameIdx({ track: atkTrack, timeSec: 0, dodgeStartSec: null, heldItem: SWORD_ID, swingProgress: 0.5 })).toBe(1);
    expect(computePoseFrameIdx({ track: atkTrack, timeSec: 0, dodgeStartSec: null, heldItem: "pickaxe", swingProgress: 0.2 })).toBe(2);
    expect(resolveWeaponChargeTint(0.5, 0.0, 0xffffff)).toBe(0xfef08a);
    expect(resolveWeaponChargeTint(0.5, 0.1, 0xffffff)).toBe(0xfacc15);
  });

  it("supports flint-dagger, wooden-spear, iron-greatsword visuals, icons, heavy smear boost & feedback cues", () => {
    for (const id of ["flint-dagger", "wooden-spear", GREAT_ID] as const) {
      expect(getItemDef(id)).toBeDefined();
      expect(WEAPON_ITEM_PAINTERS[id]).toBeTypeOf("function");
      expect(getHeldWeaponVisual(id, 0, 0)).not.toBeNull();
    }
    expect(getItemDef(GREAT_ID)?.twoHanded).toBe(true);
    expect(RECIPE_CATALOG.some((r) => r.outputItemId === GREAT_ID)).toBe(true);
    const layout = gearLayoutFor({
      snap: makePlayer({ heldItem: GREAT_ID }),
      visual: getHeldWeaponVisual(GREAT_ID, 0, 0), timeSec: 0, is3d: false,
    });
    expect(layout.main).toBeDefined();

    const baseSmear = resolveWeaponSmearSpec(SWORD_ID, 1, false);
    const heavySmear = resolveWeaponSmearSpec(SWORD_ID, 1, true);
    expect(heavySmear.smear.radius).toBe(baseSmear.smear.radius + 3);
    expect(heavySmear.smear.edge).toBe(0xfef08a);
    expect(resolveFeedbackEventCue({ kind: "guardBreak", x: 0, y: 0 })?.text).toBe("GUARD BREAK!");
    expect(resolveFeedbackEventCue({ kind: "riposte", x: 0, y: 0 })?.text).toBe("RIPOSTE!");
    expect(resolveFeedbackEventCue({ kind: "slamImpact", x: 0, y: 0 })?.style).toBe("ring");
    expect(resolveFeedbackEventCue({ kind: "burnTick", x: 0, y: 0, value: 4 })?.text).toBe("-4");
    expect(resolveFeedbackEventCue({ kind: "burnExtinguish", x: 0, y: 0 })?.text).toBe("DOUSED");
  });

  it("shows Backstab Reticle only behind unaware in-range targets and handles crouch toggle/hold + swing timeline", () => {
    const hero = makePlayer({ x: 10, y: 10, crouching: true });
    expect(canShowBackstabReticle(makeEntity({ x: 11.8, y: 10, facingX: 1, aiState: "idle" }), hero)).toBe(true);
    expect(canShowBackstabReticle(makeEntity({ x: 11.8, y: 10, facingX: -1, aiState: "idle" }), hero)).toBe(false);
    expect(canShowBackstabReticle(makeEntity({ x: 11.8, y: 10, facingX: 1, aiState: "chase" }), hero)).toBe(false);

    expect(nextCrouchState("toggle", false, "press")).toBe(true);
    expect(nextCrouchState("toggle", true, "release")).toBe(true);
    expect(nextCrouchState("hold", false, "press")).toBe(true);
    expect(nextCrouchState("hold", true, "release")).toBe(false);
    expect(nextCrouchState("hold", true, "blur")).toBe(false);

    const tracker = new LocalSwingTracker();
    const events: never[] = [];
    tracker.step({ dt: 0.05, attack: true, attackHold: true, heldId: SWORD_ID, player: makePlayer(), normAim: { x: 1, y: 0 }, isServer: true, events });
    for (let i = 0; i < 6; i++) tracker.step({ dt: 0.05, attack: false, attackHold: true, heldId: SWORD_ID, player: makePlayer(), normAim: { x: 1, y: 0 }, isServer: true, events });
    expect(tracker.snapshotOverride().heavyCharge).toBeGreaterThan(0.4);
  });
});
