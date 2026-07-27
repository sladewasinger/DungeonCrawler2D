import { describe, expect, it } from "vitest";
import { awardKillXp } from "./xp.js";
import { makeEnemySlot, makeSlot, makeXpSim, slimeDef } from "./xp.testSupport.js";

describe("awardKillXp range", () => {
  it("does not award a player who swung this tick but was out of range", () => {
    const sim = makeXpSim();
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(50, 50, slimeDef);
    awardKillXp(sim, enemy);
    expect(a.stored.xp).toBe(0);
  });
});
