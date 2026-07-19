import { JUMP_VELOCITY } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import type { GameSim } from "../index.js";
import { findFlatFloor, findSafeRoomDoor, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 3 regressions: standing hazards, fall damage, and the jump-off
 * fall-height rule — ported from reference/game-server/sim.test.ts.
 * Fall-damage arithmetic (SAFE_FALL_HEIGHT, FALL_DAMAGE_PER_UNIT) is
 * unchanged by the jump/gravity rework (docs/PORT_PLAN.md's "Redesign
 * after baseline" #1); only the airtime to reach the ground got
 * faster, so the original tick budgets still cover a full arc.
 */

describe("GameSim: standing effects and fall damage", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("standing in fire ignites you; fire cannot exist in sanctuary", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    sim.areas.spawn("area-fire", Math.floor(entity.body.x), Math.floor(entity.body.y), 0);
    const snap = sim.step().get(a.playerId)!;
    expect(snap.self.fx).toContain("on-fire");

    const door = findSafeRoomDoor(sim);
    teleport(entity, door.x + 0.5, door.y + 0.5, sim); // stand on the overworld door tile
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step(); // teleports into the shared safe room (sanctuary)
    sim.areas.spawn("area-fire", Math.floor(entity.body.x), Math.floor(entity.body.y), 1);
    expect(sim.areas.defAt(Math.floor(entity.body.x), Math.floor(entity.body.y))).toBeNull();
  });

  it("falls hurt; feather-fall negates", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    entity.maxHp = 100;
    entity.hp = 100;
    const flat = findFlatFloor(sim, 28, 28);

    const dropFrom = (height: number) => {
      teleport(entity, flat.x, flat.y, sim);
      entity.body.z = height;
      entity.body.grounded = false;
      entity.body.zVel = 0;
      entity.body.fallStart = height;
      stepN(sim, 30); // ~1.5 s of gravity — well over the (faster) new fall time
      expect(entity.body.grounded).toBe(true);
      expect(entity.body.z).toBe(0);
    };

    dropFrom(4);
    // (8 - SAFE_FALL 3) x 6 dmg/unit = 30.
    expect(entity.hp).toBe(70);

    dropFrom(1); // under the safe-fall threshold: free
    expect(entity.hp).toBe(70);

    sim.effects.applyStatus(entity, "feather-fall", []);
    dropFrom(4);
    expect(entity.hp).toBe(70);
  });

  it("jumping off a low platform hurts no more than walking off it", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    entity.maxHp = 100;
    entity.hp = 100;
    const flat = findFlatFloor(sim, 28, 28);
    // Airborne as if the player jumped at the edge of a +2 platform over
    // flat ground: fall height is measured from the takeoff z (2), not
    // the arc's peak, so it stays under SAFE_FALL and is free — that
    // invariant is unchanged by the jump retune (see movement/physics.ts).
    teleport(entity, flat.x, flat.y, sim);
    entity.body.z = 1;
    entity.body.fallStart = 1;
    entity.body.zVel = JUMP_VELOCITY;
    entity.body.grounded = false;
    stepN(sim, 40); // up, over the (now snappier) peak, down, land
    expect(entity.body.grounded).toBe(true);
    expect(entity.body.z).toBe(0);
    expect(entity.hp).toBe(100);
  });
});
