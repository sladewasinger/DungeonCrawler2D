/** Proves the authoritative immediate, periodic, refresh, clamp, and expiry bandage contract. */
import { TICK_RATE, type GameEvent, type ServerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim } from "./support.js";

function healingEvents(snapshot: ServerSnapshot): GameEvent[] {
  return snapshot.events.filter(
    (event) => event.t === "health" && event.kind === "heal",
  );
}

function useBandage(hp: number) {
  const sim = makeSim(1234, { testFixtures: true, freezeEnemies: true });
  const joined = sim.addPlayer("A", "bandage-contract");
  const entity = sim.getPlayerEntity(joined.playerId)!;
  entity.hp = hp;
  sim.queueAction(joined.playerId, { type: "useItem", item: "bandage" });
  const snapshot = sim.step().get(joined.playerId)!;
  return { sim, joined, entity, snapshot };
}

describe("authoritative bandage contract", () => {
  it("heals +4 immediately, then +2 once per second for five ticks and expires", () => {
    const { sim, joined, entity, snapshot } = useBandage(10);
    expect(healingEvents(snapshot)).toEqual([
      { t: "health", id: joined.playerId, delta: 4, kind: "heal" },
    ]);
    expect(snapshot.self.statusEffects).toContainEqual({
      id: "bandaged",
      remainingSeconds: 5 - 1 / TICK_RATE,
      durationSeconds: 5,
    });

    const periodic: GameEvent[] = [];
    for (let tick = 1; tick < 5 * TICK_RATE; tick++) {
      const next = sim.step().get(joined.playerId)!;
      periodic.push(...healingEvents(next));
    }
    expect(periodic).toEqual(Array.from({ length: 5 }, () => ({
      t: "health",
      id: joined.playerId,
      delta: 2,
      kind: "heal",
    })));
    expect(entity.hp).toBe(24);
    expect(entity.statuses.some((status) => status.defId === "bandaged")).toBe(false);
  });

  it("refreshes both the immediate heal and the full five-second cadence", () => {
    const { sim, joined, entity } = useBandage(2);
    for (let tick = 0; tick < TICK_RATE / 2; tick++) sim.step();
    sim.queueAction(joined.playerId, { type: "useItem", item: "bandage" });
    const refreshed = sim.step().get(joined.playerId)!;
    expect(healingEvents(refreshed)[0]).toMatchObject({ delta: 4, kind: "heal" });
    expect(entity.statuses[0]).toMatchObject({
      defId: "bandaged",
      remaining: 5 - 1 / TICK_RATE,
      tickAccum: 1 / TICK_RATE,
    });
    for (let tick = 1; tick < TICK_RATE - 1; tick++) sim.step();
    expect(entity.hp).toBe(10);
    sim.step();
    expect(entity.hp).toBe(12);
  });

  it("clamps healing to max health and reports only the applied positive delta", () => {
    const { entity, snapshot } = useBandage(28);
    expect(entity.hp).toBe(30);
    expect(healingEvents(snapshot)).toHaveLength(1);
    expect(healingEvents(snapshot)[0]).toMatchObject({
      delta: 2,
      kind: "heal",
    });
  });
});
