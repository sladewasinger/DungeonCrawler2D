import { CHASM_DEATH_Z, LEVEL, PLAYER_MAX_HP, World, hashString, type ContentRegistry, type ServerSnapshot } from "@dc2d/engine";
import { expect } from "vitest";
import { PlayerStore } from "../../store.js";
import { DEATH_TO_RESPAWN_TICKS } from "../combat/deathTestSupport.js";
import { GameSim } from "../core/index.js";
import { SPAWN_CLEARANCE_RADIUS, SPAWN_GRACE_TICKS } from "./spawnSafety.js";

interface LiveGraceCase {
  content: ContentRegistry;
  seed: number;
}

export function assertLiveGraceCase({ content, seed }: LiveGraceCase): void {
  const sim = createLiveGraceSim(content, seed);
  const join = addLiveGracePlayers(sim, seed);
  blanketJoin(sim, join.spawn, seed);
  sampleGraceWindow({ sim, playerId: join.playerId, graceUntil: sim.tick + SPAWN_GRACE_TICKS, label: `seed ${seed} join` });
  assertRespawnGrace(sim, join.playerId, seed);
}

function createLiveGraceSim(content: ContentRegistry, seed: number): GameSim {
  const world = new World(hashString(`grace-fuzz-${seed}`), 1, LEVEL.Dungeon);
  return new GameSim({ world: world, content: content, store: new PlayerStore(null), rngSeed: seed, opts: { spawnRadiusTiles: 12, debugCommands: true } });
}

function addLiveGracePlayers(sim: GameSim, seed: number): { playerId: string; spawn: { x: number; y: number } } {
  const bait = sim.addPlayer({ name: "Bait", clientId: `bait-${seed}` });
  sim.endSpawnGrace(bait.playerId);
  const join = sim.addPlayer({ name: "Fuzz", clientId: `fuzz-${seed}` });
  sim.queueAction(bait.playerId, { type: "debug", op: "teleport", x: join.spawn.x, y: join.spawn.y });
  return join;
}

function blanketJoin(sim: GameSim, spawn: { x: number; y: number }, seed: number): void {
  let parked = 0;
  for (const tile of gridAround({ x: Math.floor(spawn.x), y: Math.floor(spawn.y) }, 20, 4)) {
    if (!isHostileFloor(sim.world, tile)) continue;
    sim.spawnEnemy("slime", tile.x + 0.5, tile.y + 0.5);
    parked++;
  }
  expect(parked, `seed ${seed}: blanket too sparse`).toBeGreaterThan(10);
}

function* gridAround(anchor: { x: number; y: number }, radius: number, step: number) {
  for (let y = anchor.y - radius; y <= anchor.y + radius; y += step) {
    for (let x = anchor.x - radius; x <= anchor.x + radius; x += step) yield { x, y };
  }
}

function isHostileFloor(world: World, tile: { x: number; y: number }): boolean {
  return world.isWalkable(tile.x, tile.y) &&
    !world.isSanctuary(tile.x, tile.y) &&
    world.heightAt(tile.x, tile.y) > CHASM_DEATH_Z;
}

function assertRespawnGrace(sim: GameSim, playerId: string, seed: number): void {
  sim.getPlayerEntity(playerId)!.hp = 0;
  waitForRespawn(sim, playerId);
  expect(sim.getWeapon(playerId), `seed ${seed}: respawned unarmed`).toBe("sword");
  expect(sim.getPlayerEntity(playerId)!.hp, `seed ${seed}: never respawned`).toBe(PLAYER_MAX_HP);
  sampleGraceWindow({ sim, playerId, graceUntil: sim.tick + SPAWN_GRACE_TICKS, label: `seed ${seed} respawn` });
}

function waitForRespawn(sim: GameSim, playerId: string): void {
  for (let guard = 0; guard < DEATH_TO_RESPAWN_TICKS + 5; guard++) {
    if (sim.getPlayerEntity(playerId)!.hp === PLAYER_MAX_HP) return;
    sim.step();
  }
}

function sampleGraceWindow({ sim, playerId, graceUntil, label }: {
  sim: GameSim;
  playerId: string;
  graceUntil: number;
  label: string;
}): void {
  while (sim.tick + 1 < graceUntil) assertGraceSnapshot(sim.step().get(playerId) as ServerSnapshot, sim.tick, label);
}

function assertGraceSnapshot(snapshot: ServerSnapshot, tick: number, label: string): void {
  expect(nearestEnemyDistance(snapshot), `${label} tick ${tick}: hostile inside graced clearance`)
    .toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
  expect(snapshot.self.hp, `${label} tick ${tick}: damage before first input`).toBe(PLAYER_MAX_HP);
}

function nearestEnemyDistance(snapshot: ServerSnapshot): number {
  return snapshot.entities
    .filter((entity) => entity.kind === "enemy")
    .reduce((nearest, entity) => Math.min(nearest, Math.hypot(entity.x - snapshot.self.x, entity.y - snapshot.self.y)), Infinity);
}
