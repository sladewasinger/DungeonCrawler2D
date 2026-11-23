import { describe, expect, it } from "vitest";
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { EntityVelocityTracker, resolveMobileBowAutoAim, resolveMobileMeleeAutoAim } from "./autoAim.js";

function makePlayer(): PlayerSnapshot {
  return {
    id: "p1", name: "Hero", x: 0, y: 0, elevation: 0, facingX: 1, facingY: 0,
    moving: false, torchLit: false, inWater: false, lastAckSeq: 1,
  };
}

function makeMob(id: string, x: number, y: number): WorldEntitySnapshot {
  return {
    id, kind: "wolf", substance: "blood", x, y, elevation: 0, facingX: -1, facingY: 0,
    hp: 40, maxHp: 40, hitTimer: 0, staggerTimer: 0, bleedTimer: 0, telegraphProgress: 0,
  };
}

describe("mobile auto-aim", () => {
  it("picks the closest enemy inside the forward 100-degree melee cone and ignores enemies behind", () => {
    const local = makePlayer();
    const behind = makeMob("m-back", -0.9, 0);
    const inFront = makeMob("m-front", 2.2, 0.8);
    const aim = resolveMobileMeleeAutoAim({ local, entities: [behind, inFront], facing: { x: 1, y: 0 } });
    expect(aim).toBeDefined();
    expect(aim!.x).toBeGreaterThan(0.8);
    expect(aim!.y).toBeGreaterThan(0.2);
  });

  it("gently leads moving bow targets within 5 degrees and ignores wide targets", () => {
    const local = makePlayer();
    const tracker = new EntityVelocityTracker();
    tracker.update([makeMob("m1", 8, 0.2)], 0);
    tracker.update([makeMob("m1", 8, 0.45)], 100);
    const assisted = resolveMobileBowAutoAim({ aim: { x: 1, y: 0 }, local, entities: [makeMob("m1", 8, 0.45)], tracker, arrowSpeed: 16 });
    expect(assisted.y).toBeGreaterThan(0.03);
    expect(Math.acos(assisted.x)).toBeLessThanOrEqual((5.1 * Math.PI) / 180);

    const farOff = resolveMobileBowAutoAim({ aim: { x: 0, y: 1 }, local, entities: [makeMob("m1", 8, 0.45)], tracker, arrowSpeed: 16 });
    expect(farOff.x).toBeCloseTo(0, 4);
    expect(farOff.y).toBeCloseTo(1, 4);
  });
});