import { PLAYER_MAX_HP, RESPAWN_DELAY_TICKS, TICK_RATE, type ServerSnapshot } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import type { GameSim } from "../index.js";
import { SWING_TICKS, findFlatArena, findSafeRoomDoor, makeParty, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 6 regressions: melee cooldown/targeting/damage, ranged enemies,
 * PvP suppression, and chase/loot — ported from
 * reference/game-server/sim.test.ts. Multi-entity positioning uses
 * `findFlatArena`: the BSP overworld isn't hand-flattened like v1's
 * sandbox chunk, so a couple of tiles' offset can land a target out of
 * melee's ±1.5 vertical reach unless the whole cluster is co-height.
 */

describe("GameSim: combat", () => {
  let sim: GameSim;
  let arena: { x: number; y: number };

  beforeEach(() => {
    sim = makeSim();
    arena = findFlatArena(sim, 28, 28);
  });

  it("melee swings gate on a cooldown — spam clicks land exactly one hit", () => {
    const a = sim.addPlayer("A", "client-a");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    teleport(aEntity, arena.x, arena.y, sim);
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1, aEntity.body.y);
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    teleport(slime, aEntity.body.x + 1, aEntity.body.y, sim); // undo knockback
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 3);

    stepN(sim, SWING_TICKS);
    teleport(slime, aEntity.body.x + 1, aEntity.body.y, sim);
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 6);
  });

  it("replicates a short peer attack pose for every accepted swing", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport(bEntity, aEntity.body.x, aEntity.body.y + 3, sim);

    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    let snapshots = sim.step();
    expect(snapshots.get(b.playerId)!.entities.find((entry) => entry.id === a.playerId)?.anim).toBe("attack");

    snapshots = stepN(sim, 4);
    expect(snapshots.get(b.playerId)!.entities.find((entry) => entry.id === a.playerId)?.anim).toBeUndefined();
  });

  it("melee prefers the enemy over an adjacent party member (targeting aid)", () => {
    const { aId, bId } = makeParty(sim);
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    teleport(aEntity, arena.x, arena.y, sim);
    // Friend closer than the slime, both in the swing arc; the slime
    // sits just outside its own bite range so it can't muddy the test.
    teleport(bEntity, aEntity.body.x + 0.5, aEntity.body.y, sim);
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1.5, aEntity.body.y);
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 3); // fists
    expect(bEntity.hp).toBe(PLAYER_MAX_HP); // friend untouched

    // No hostile in arc -> the friend takes the hit. Trust, not immunity.
    slime.hp = 0;
    sim.step(); // reap the corpse
    stepN(sim, SWING_TICKS); // let the swing cooldown recover
    teleport(bEntity, aEntity.body.x + 0.5, aEntity.body.y, sim);
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP - 3);
  });

  it("weapons carry damage, statuses, and source tags (knife bleeds a player)", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport(aEntity, arena.x, arena.y, sim);
    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    sim.getInventory(a.playerId)!.push({ item: "knife", qty: 1 });
    sim.queueAction(a.playerId, { type: "equip", item: "knife" });
    sim.step();
    expect(sim.getWeapon(a.playerId)).toBe("knife");
    // Swing until the 40% bleed chance lands (seeded rng, bounded),
    // waiting out the swing cooldown between attempts.
    for (let i = 0; i < 10 && !bEntity.statuses.some((s) => s.defId === "bleeding"); i++) {
      sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
      sim.step();
      teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim); // undo knockback
      stepN(sim, SWING_TICKS);
      teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    }
    expect(bEntity.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(bEntity.statuses.some((s) => s.defId === "bleeding")).toBe(true);
  });

  it("spitters broadcast windup, release, and recovery states around a delayed projectile", () => {
    const player = sim.addPlayer("Target", "spitter-target");
    const entity = sim.getPlayerEntity(player.playerId)!;
    teleport(entity, arena.x, arena.y, sim);
    const spitter = sim.spawnEnemy("spitter", entity.body.x + 6, entity.body.y);

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
    const player = sim.addPlayer("Target", "melee-target");
    const entity = sim.getPlayerEntity(player.playerId)!;
    teleport(entity, arena.x, arena.y, sim);
    const skeleton = sim.spawnEnemy("skeleton", entity.body.x + 0.8, entity.body.y);

    const first = sim.step().get(player.playerId)!;
    expect(first.entities.find((entry) => entry.id === skeleton.id)?.anim).toBe("attack");

    const recovery = stepN(sim, 4).get(player.playerId)!;
    expect(recovery.entities.find((entry) => entry.id === skeleton.id)?.anim).toBe("recover");

    const afterRecovery = stepN(sim, 3).get(player.playerId)!;
    expect(afterRecovery.entities.find((entry) => entry.id === skeleton.id)?.anim).toBe("idle");
  });

  it("sanctuary suppresses PvP entirely", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    const door = findSafeRoomDoor(sim);
    teleport(aEntity, door.x + 0.5, door.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" }); // steps into the shared safe room
    sim.step();
    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP);
  });

  it("enemies chase and hurt players; kills drop loot and respawn far away", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    // A wider clearance than the shared `arena`: the enemy spawns 3
    // tiles out and must walk the whole gap to reach the player, so the
    // approach path itself (not just the two endpoints) has to be real,
    // wall-free floor.
    const wideArena = findFlatArena(sim, 28, 28, 3);
    teleport(entity, wideArena.x, wideArena.y, sim);
    sim.spawnEnemy("skeleton", entity.body.x + 3, entity.body.y);
    stepN(sim, TICK_RATE * 4); // it closes in and swings
    expect(entity.hp).toBeLessThan(PLAYER_MAX_HP);

    // Force the kill: full loot drop where they fell, then respawn.
    sim.getInventory(a.playerId)!.push({ item: "torch", qty: 2 });
    const deathX = entity.body.x;
    entity.hp = 0;
    sim.step();
    const respawnSnaps = stepN(sim, RESPAWN_DELAY_TICKS + 2);
    const snap = respawnSnaps.get(a.playerId)!;
    expect(snap.self.hp).toBe(PLAYER_MAX_HP);
    expect(sim.getInventory(a.playerId)!.length).toBe(0);
    expect(Math.abs(snap.self.x - deathX)).toBeGreaterThan(1); // moved elsewhere
  });

  it("dead enemies roll their drop table", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    teleport(entity, arena.x, arena.y, sim);
    // plant-creeper drops stick @90% — kill a few to see one.
    for (let i = 0; i < 3; i++) {
      const plant = sim.spawnEnemy("plant-creeper", entity.body.x + 2 + i, entity.body.y);
      plant.hp = 0;
    }
    const snap = sim.step().get(a.playerId)!;
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "stick")).toBe(true);
  });
});
