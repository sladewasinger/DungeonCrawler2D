import {
  AOI_RADIUS,
  CHUNK_SIZE,
  createBody,
  hashString,
  makeEntity,
  populationRoomsForChunk,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveDeaths } from "../../../combat/deaths.js";
import type { EnemySlot, PlayerSlot, SimState } from "../../../state/state.js";
import { stepEnemies } from "../../ai.js";
import { spawnMiniBossEncounter } from "../../miniBossArena/population.js";
import {
  syncObservableMiniBossEncounters,
} from "../../miniBossArena/observation/observablePopulation.js";
import {
  createMiniBossPopulationSim,
  findMiniBossPopulationArena,
  requireMiniBossArenaLeader,
  spawnMiniBossPopulationEncounter,
} from "./populationTestSupport.js";

describe("mini-boss arena population", () => {
  it("spawns one explicit leader and three minions inside its arena", () => {
    const sim = createMiniBossPopulationSim("mini-boss-rooms");
    const arena = spawnMiniBossPopulationEncounter(sim);
    const enemies = [...sim.enemies.values()];
    const leader = requireMiniBossArenaLeader(sim);
    const home = requireEnemyHome(leader);

    expect(enemies).toHaveLength(4);
    expect(enemies.filter((enemy) => enemy.arenaLeader)).toHaveLength(1);
    for (const enemy of enemies) assertEnemyInArena(enemy, arena.key, home);
  });

  it("does not respawn a defeated arena encounter", () => {
    const sim = createMiniBossPopulationSim("mini-boss-defeat");
    const arena = spawnMiniBossPopulationEncounter(sim);
    for (const enemy of sim.enemies.values()) enemy.entity.hp = 0;
    resolveDeaths(sim);
    expect(spawnMiniBossEncounter(sim, arena.chunk.cx, arena.chunk.cy)).toBe(false);
  });

  it("keeps every live arena enemy inside the arena home", () => {
    const sim = createMiniBossPopulationSim("mini-boss-leash");
    const arena = spawnMiniBossPopulationEncounter(sim);
    const home = requireEnemyHome(requireMiniBossArenaLeader(sim));
    addBaitPlayer(sim, home);
    for (let tick = 0; tick < 200; tick++) stepEnemies(sim, []);
    for (const enemy of sim.enemies.values()) assertEnemyInArena(enemy, arena.key, home);
  });

  it("keeps encounters loaded only while a connected crawler can observe them", () => {
    const sim = createMiniBossPopulationSim("mini-boss-observation");
    const arena = findMiniBossPopulationArena(sim);
    if (!arena) throw new Error("missing arena fixture");
    const player = addBaitPlayer(sim, arena.interior);

    syncObservableMiniBossEncounters(sim);
    expect(arenaEnemyCount(sim, arena.key)).toBe(4);

    player.entity.body.x += AOI_RADIUS * 3;
    player.entity.body.y += AOI_RADIUS * 3;
    syncObservableMiniBossEncounters(sim);
    expect(arenaEnemyCount(sim, arena.key)).toBe(0);

    player.entity.body.x = arena.center.x + 0.5;
    player.entity.body.y = arena.center.y + 0.5;
    syncObservableMiniBossEncounters(sim);
    expect(arenaEnemyCount(sim, arena.key)).toBe(4);
  });

  it("reports direct room bounds inside their owning chunk", () => {
    const rooms = populationRoomsForChunk({
      worldSeed: hashString("room-bounds"),
      floor: 1,
      cx: 2,
      cy: -3,
    });
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) assertRoomInChunk(room);
  });
});

function requireEnemyHome(enemy: EnemySlot): NonNullable<EnemySlot["home"]> {
  if (!enemy.home) throw new Error("arena leader lacks home bounds");
  return enemy.home;
}

function assertEnemyInArena(
  enemy: EnemySlot,
  arenaKey: string,
  home: NonNullable<EnemySlot["home"]>,
): void {
  expect(enemy.arenaKey).toBe(arenaKey);
  expect(enemy.home).toEqual(home);
  expect(enemy.entity.body.x).toBeGreaterThanOrEqual(home.x0);
  expect(enemy.entity.body.x).toBeLessThan(home.x1 + 1);
  expect(enemy.entity.body.y).toBeGreaterThanOrEqual(home.y0);
  expect(enemy.entity.body.y).toBeLessThan(home.y1 + 1);
}

function addBaitPlayer(
  sim: SimState,
  home: NonNullable<EnemySlot["home"]>,
): PlayerSlot {
  const body = createBody(home.x1 + 2.5, (home.y0 + home.y1) / 2, 0);
  const entity = makeEntity("player", body, {
    id: "bait",
    hp: 100,
    maxHp: 100,
  });
  const player = {
    entity,
    connected: true,
    downedAtTick: null,
    spawnGraceUntilTick: 0,
  } as PlayerSlot;
  sim.players.set("bait", player);
  return player;
}

function arenaEnemyCount(sim: SimState, arenaKey: string): number {
  return [...sim.enemies.values()].filter((enemy) =>
    enemy.arenaKey === arenaKey
  ).length;
}

interface PopulationRoom {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly area: number;
}

function assertRoomInChunk(room: PopulationRoom): void {
  expect(room.x0).toBeGreaterThanOrEqual(2 * CHUNK_SIZE);
  expect(room.x1).toBeLessThan(3 * CHUNK_SIZE);
  expect(room.y0).toBeGreaterThanOrEqual(-3 * CHUNK_SIZE);
  expect(room.y1).toBeLessThan(-2 * CHUNK_SIZE);
  expect(room.area).toBe((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1));
}
