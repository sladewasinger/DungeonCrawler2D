import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type EnemyDef, xpForLevel } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { announceKill, announceLevelUp } from "../announcer/index.js";
import { awardKillXp } from "./xp.js";
import { makeEnemySlot, makeSlot, makeXpSim, slimeDef } from "./xp.testSupport.js";
import type { SimState } from "../state/state.js";

/**
 * Unit tests for sim/xp.ts: the level curve inversion and the kill-XP
 * award hook (attribution, persistence, level-up chat line). The GameSim
 * integration path (real melee kill -> snapshot self.xp) lives in
 * sim/integration/xp.test.ts.
 */

describe("awardKillXp", () => {
  let sim: SimState;

  beforeEach(() => {
    sim = makeXpSim();
  });

  it("awards the enemy's xp to the player who swung this tick in range", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(5);
    expect(a.stored.level).toBe(1); // below the level-2 threshold (100)
  });

  it("does not award a player who did not swing this exact tick", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount - 1; // swung last tick, not this one
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(0);
  });

  it("attributes to the nearer of two same-tick swingers and leaves the other untouched", () => {
    const near = makeSlot("Near", 5.2, 5);
    near.attackStartedAtTick = sim.tickCount;
    const far = makeSlot("Far", 6, 5);
    far.attackStartedAtTick = sim.tickCount;
    sim.players.set(near.entity.id, near);
    sim.players.set(far.entity.id, far);
    const enemy = makeEnemySlot(5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(near.stored.xp).toBe(5);
    expect(far.stored.xp).toBe(0); // no award for the other player's non-kill
  });

  it("awards nothing for an enemy def without an xp value", () => {
    const noXpDef: EnemyDef = { ...slimeDef, xp: undefined };
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, noXpDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(0);
  });

  it("broadcasts an announcer level-up line when a kill crosses a level threshold", () => {
    const bigXpDef: EnemyDef = { ...slimeDef, xp: xpForLevel(2) };
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, bigXpDef);

    awardKillXp(sim, enemy);

    expect(a.stored.level).toBe(2);
    // Broadcast, not private: every connected slot (here, just the killer)
    // gets the exact deterministic line the announcer picks for this tick.
    expect(a.outbox).toContainEqual(announceLevelUp({
      tick: sim.tickCount,
      playerId: a.entity.id,
      name: "A",
      level: 2,
    }));
  });

  it("sends the killer a private personal kill line naming the enemy's epithet", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.outbox).toContainEqual(announceKill(sim.tickCount, a.entity.id, slimeDef));
    const killLine = a.outbox.find(
      (ev) => ev.t === "chat" && ev.text.startsWith("Dissolved a slime"),
    );
    expect(killLine).toBeDefined();
  });

  it("delivers the personal kill line only to the killer, never broadcasts it", () => {
    const killer = makeSlot("Killer", 5, 5);
    killer.attackStartedAtTick = sim.tickCount;
    const bystander = makeSlot("Bystander", 5, 5);
    sim.players.set(killer.entity.id, killer);
    sim.players.set(bystander.entity.id, bystander);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    const bystanderKillLine = bystander.outbox.find(
      (ev) => ev.t === "chat" && ev.text.startsWith("Dissolved a slime"),
    );
    expect(bystanderKillLine).toBeUndefined();
  });

  it("persists the award via PlayerStore (survives a fresh load from the same file)", () => {
    const file = join(tmpdir(), `dc2d-xp-store-${Date.now()}-${Math.random()}.json`);
    try {
      const store = new PlayerStore(file);
      const localSim = makeXpSim(store);
      const a = makeSlot("A", 5, 5);
      a.stored = store.get(a.clientId, "A"); // the actual persisted record, not a throwaway literal
      a.attackStartedAtTick = localSim.tickCount;
      localSim.players.set(a.entity.id, a);
      const enemy = makeEnemySlot(5.5, 5, slimeDef);

      awardKillXp(localSim, enemy);
      store.flush();

      const reloaded = new PlayerStore(file);
      const record = reloaded.get(a.clientId, "A");
      expect(record.xp).toBe(5);
      expect(record.level).toBe(1);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
