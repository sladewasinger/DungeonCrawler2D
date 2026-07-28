import {
  FIST_DAMAGE,
  PARTY_FRIENDLY_FIRE_SCALE,
  PLAYER_MAX_HP,
  featureApproachPosition,
  type ServerSnapshot,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import type { GameSim } from "../../core/index.js";
import { SWING_TICKS, findFlatArena, findFlatFloor, findSafeRoomDoor, makeParty, makeSim, stepN, teleport } from "../support.js";

/**
 * Epic 6 regressions: melee cooldown/targeting/damage, ranged enemies,
 * PvP suppression, and chase/loot. Multi-entity positioning uses
 * `findFlatArena`: variable terrain means a couple of tiles' offset can
 * land a target out of
 * melee's ±1.5 vertical reach unless the whole cluster is co-height.
 */

describe("GameSim: combat", () => {
  let sim: GameSim;
  let arena: { x: number; y: number };

  beforeEach(() => {
    sim = makeSim();
    arena = findFlatArena({ sim: sim, anchor: { x: 28, y: 28 } });
  });

  it("melee swings gate on a cooldown — spam clicks land exactly one hit", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    teleport({ entity: aEntity, x: arena.x, y: arena.y, sim: sim });
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1, aEntity.body.y);
    sim.queueAction(a.playerId, { type: "equip", item: null }); // fists: the starter sword auto-equips
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    teleport({ entity: slime, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim }); // undo knockback
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 3);

    stepN(sim, SWING_TICKS);
    teleport({ entity: slime, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim });
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 6);
  });

  it("replicates a short peer attack pose for every accepted swing", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport({ entity: bEntity, x: aEntity.body.x, y: aEntity.body.y + 3, sim: sim });

    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    let snapshots = sim.step();
    expect(snapshots.get(b.playerId)!.entities.find((entry) => entry.id === a.playerId)).toMatchObject({
      anim: "attack",
      weapon: "sword",
    });

    snapshots = stepN(sim, 4);
    expect(snapshots.get(b.playerId)!.entities.find((entry) => entry.id === a.playerId)?.anim).toBeUndefined();
  });

  it("melee prefers the enemy over an adjacent party member (targeting aid)", () => {
    const { aId, bId } = makeParty(sim);
    sim.endSpawnGrace(bId); // hand-placed victim, not a fresh spawn (spawnSafety.ts)
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    teleport({ entity: aEntity, x: arena.x, y: arena.y, sim: sim });
    // Friend closer than the slime, both in the swing arc; the slime
    // sits just outside its own bite range so it can't muddy the test.
    teleport({ entity: bEntity, x: aEntity.body.x + 0.5, y: aEntity.body.y, sim: sim });
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1.5, aEntity.body.y);
    sim.queueAction(aId, { type: "equip", item: null }); // fists: the starter sword auto-equips
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 3); // fists
    expect(bEntity.hp).toBe(PLAYER_MAX_HP); // friend untouched

    // No hostile in arc -> the friend takes the reduced hit. Trust, not immunity.
    slime.hp = 0;
    sim.step(); // reap the corpse
    stepN(sim, SWING_TICKS); // let the swing cooldown recover
    teleport({ entity: bEntity, x: aEntity.body.x + 0.5, y: aEntity.body.y, sim: sim });
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP - FIST_DAMAGE * PARTY_FRIENDLY_FIRE_SCALE);
  });

  it("weapons carry damage, statuses, and source tags (knife bleeds a player)", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    sim.endSpawnGrace(b.playerId); // hand-placed victim, not a fresh spawn (spawnSafety.ts)
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport({ entity: aEntity, x: arena.x, y: arena.y, sim: sim });
    teleport({ entity: bEntity, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim });
    sim.getInventory(a.playerId)!.push({ item: "knife", qty: 1 });
    sim.queueAction(a.playerId, { type: "equip", item: "knife" });
    sim.step();
    expect(sim.getWeapon(a.playerId)).toBe("knife");
    // Swing until the 40% bleed chance lands (seeded rng, bounded),
    // waiting out the swing cooldown between attempts.
    for (let i = 0; i < 10 && !bEntity.statuses.some((s) => s.defId === "bleeding"); i++) {
      sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
      sim.step();
      teleport({ entity: bEntity, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim }); // undo knockback
      stepN(sim, SWING_TICKS);
      teleport({ entity: bEntity, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim });
    }
    expect(bEntity.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(bEntity.statuses.some((s) => s.defId === "bleeding")).toBe(true);
  });

  it("spitters broadcast windup, release, and recovery states around a delayed projectile", () => {
    const player = sim.addPlayer({ name: "Target", clientId: "spitter-target" });
    sim.endSpawnGrace(player.playerId); // hand-placed bait, not a fresh spawn (spawnSafety.ts)
    const entity = sim.getPlayerEntity(player.playerId)!;
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });
    const spitterSpot = findFlatFloor(sim, entity.body.x + 6, entity.body.y);
    const spitter = sim.spawnEnemy("spitter", spitterSpot.x, spitterSpot.y);

    let snapshots = sim.step();
    const findSpitter = (state: Map<string, ServerSnapshot>) =>
      state.get(player.playerId)!.entities.find((entry) => entry.id === spitter.id);
    expect(findSpitter(snapshots)?.anim).toBe("windup");
    expect(findSpitter(snapshots)?.faceX).toBeLessThan(0);

    snapshots = stepN(sim, 5);
    expect(findSpitter(snapshots)?.anim).toBe("spit");
    expect(snapshots.get(player.playerId)!.entities.some((entry) => entry.kind === "projectile")).toBe(true);

    snapshots = stepN(sim, 2);
    expect(findSpitter(snapshots)?.anim).toBe("recover");
  });

  it("melee enemies hold a replicated attack pose after landing a hit", () => {
    const player = sim.addPlayer({ name: "Target", clientId: "melee-target" });
    sim.endSpawnGrace(player.playerId); // hand-placed bait, not a fresh spawn (spawnSafety.ts)
    const entity = sim.getPlayerEntity(player.playerId)!;
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });
    const skeleton = sim.spawnEnemy("skeleton", entity.body.x + 0.8, entity.body.y);

    const first = sim.step().get(player.playerId)!;
    expect(first.entities.find((entry) => entry.id === skeleton.id)?.anim).toBe("attack");

    const recovery = stepN(sim, 4).get(player.playerId)!;
    expect(recovery.entities.find((entry) => entry.id === skeleton.id)?.anim).toBe("recover");

    const afterRecovery = stepN(sim, 3).get(player.playerId)!;
    expect(afterRecovery.entities.find((entry) => entry.id === skeleton.id)?.anim).toBe("idle");
  });

  it("sanctuary suppresses PvP entirely", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    const door = findSafeRoomDoor(sim);
    teleport({ entity: aEntity, ...featureApproachPosition(door), sim });
    sim.queueAction(a.playerId, { type: "interact" }); // steps into the shared safe room
    sim.step();
    teleport({ entity: bEntity, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim });
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP);
  });

});
