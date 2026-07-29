import type { Entity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { GameSim } from "../../core/index.js";
import { SWING_TICKS, findFlatArena, makeSim, stepN, teleport } from "../support.js";

/**
 * Epic 11 core (character levels), pulled forward into Epic 7.13 by the
 * user's second playtest: XP award through the real GameSim intent path
 * (melee attack -> enemy death -> self.xp on the next snapshot), kill
 * attribution, and "no award for someone else's kill". Level-curve
 * boundaries and the persistence-across-restart path are pure-unit tested
 * in sim/xp.test.ts and store.test.ts — no need to slow-swing a whole
 * level's worth of kills here.
 */

/** Fists deal 3 damage; a 12-hp slime (5 xp) needs 4 swings, one per cooldown window. */
interface SlimeKillScenario {
  sim: GameSim;
  playerId: string;
  target: { x: number; y: number };
  slime: Entity;
}

function makeXpSim(): GameSim {
  return makeSim(1234, { testFixtures: false, freezeEnemies: true });
}

function killSlimeWithFists({ sim, playerId, target, slime }: SlimeKillScenario): void {
  for (let i = 0; i < 4; i++) {
    teleport({ entity: slime, x: target.x, y: target.y, sim }); // undo knockback between swings
    sim.queueAction(playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    if (i < 3) stepN(sim, SWING_TICKS);
  }
}

describe("GameSim: XP award", () => {
  it("awards XP on a real melee kill, readable on the killer's next self snapshot", () => {
    const sim = makeXpSim();
    const arena = findFlatArena({ sim: sim, anchor: { x: 28, y: 28 } });
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    teleport({ entity: aEntity, x: arena.x, y: arena.y, sim: sim });
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1, aEntity.body.y);
    sim.queueAction(a.playerId, { type: "equip", item: null }); // fists: the starter sword auto-equips
    sim.step();

    killSlimeWithFists({ sim, playerId: a.playerId, target: aEntity.body, slime });
    expect(slime.hp).toBeLessThanOrEqual(0);

    const snap = sim.step().get(a.playerId)!;
    expect(snap.self.xp).toBe(5);
    expect(snap.self.level).toBe(1);
    expect(snap.self.xpForNext).toBe(95); // xpForLevel(2) = 100
  });

  it("attributes the kill only to the attacker — a nearby bystander earns nothing", () => {
    const sim = makeXpSim();
    const arena = findFlatArena({ sim: sim, anchor: { x: 28, y: 28 } });
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport({ entity: aEntity, x: arena.x, y: arena.y, sim: sim });
    teleport({ entity: bEntity, x: arena.x - 3, y: arena.y, sim: sim }); // in the AOI, well outside melee range
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1, aEntity.body.y);
    sim.queueAction(a.playerId, { type: "equip", item: null });
    sim.step();

    killSlimeWithFists({ sim, playerId: a.playerId, target: aEntity.body, slime });

    const snapshots = sim.step();
    expect(snapshots.get(a.playerId)!.self.xp).toBe(5);
    expect(snapshots.get(b.playerId)!.self.xp).toBe(0);
  });
});
