import { areasData, enemiesData, itemsData, recipesData, rulesData, statusesData } from "@dc2d/content";
import { CHUNK_SIZE, buildContentRegistry, createBody, hashString, makeEntity, miniBossArenaForChunk, populationRoomsForChunk, World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { resolveDeaths } from "../../combat/deaths.js";
import { createSimState, type EnemySlot, type PlayerSlot, type SimState } from "../../state/state.js";
import { stepEnemies } from "../ai.js";
import { spawnMiniBossEncounter } from "../miniBossArena/population.js";

const content = buildContentRegistry({
  statuses: [...statusesData], rules: [...rulesData], areas: [...areasData],
  items: [...itemsData], enemies: [...enemiesData], recipes: [...recipesData],
});
const ORC_WARLORD = "orc-warlord";

function createTestSim(seed: string): SimState {
  const worldSeed = hashString(seed);
  return createSimState({ world: new World(worldSeed, 1), content, store: new PlayerStore(null), rngSeed: worldSeed, opts: {} });
}

function spawnEncounter(sim: SimState): { x: number; y: number } {
  const chunk = encounterChunk(sim);
  if (chunk) return chunk;
  throw new Error("no mini boss encounter spawned");
}

function encounterChunk(sim: SimState): { x: number; y: number } | undefined {
  for (const y of chunkCoordinates()) {
    const x = chunkCoordinates().find((candidate) => spawnMiniBossEncounter(sim, candidate, y));
    if (x !== undefined) return { x, y };
  }
  return undefined;
}

function chunkCoordinates(): number[] {
  return Array.from({ length: 21 }, (_, index) => index - 10);
}

function requireWarlord(sim: SimState): EnemySlot {
  const warlord = [...sim.enemies.values()].find((enemy) => enemy.def.id === ORC_WARLORD);
  if (!warlord) throw new Error("missing warlord");
  return warlord;
}

function assertEnemyInHome(enemy: EnemySlot, home: NonNullable<EnemySlot["home"]>): void {
  expect(enemy.entity.body.x).toBeGreaterThanOrEqual(home.x0);
  expect(enemy.entity.body.x).toBeLessThan(home.x1 + 1);
  expect(enemy.entity.body.y).toBeGreaterThanOrEqual(home.y0);
  expect(enemy.entity.body.y).toBeLessThan(home.y1 + 1);
}

describe("large-room orc mini bosses", () => {
  it("spawns one warlord and three guards entirely inside a large room", () => {
    const sim = createTestSim("mini-boss-rooms");
    const chunk = spawnEncounter(sim);
    const enemies = [...sim.enemies.values()];
    const warlord = requireWarlord(sim);
    const home = warlord.home;
    if (!home) throw new Error("warlord lacks home room");
    const arena = miniBossArenaForChunk({
      worldSeed: sim.world.worldSeed,
      floor: sim.world.floor,
      cx: chunk.x,
      cy: chunk.y,
    });
    expect(enemies).toHaveLength(4);
    expect(home).toEqual(arena?.interior);
    for (const enemy of enemies) {
      expect(enemy.home).toEqual(home);
      expect(enemy.arenaKey).toBe(arena?.key);
      assertEnemyInHome(enemy, home);
    }
    expect(warlord.def.hp).toBeGreaterThan(content.enemies.get("orc-warrior")!.hp * 3);
  });

  it("does not respawn an entirely defeated arena encounter", () => {
    const sim = createTestSim("mini-boss-defeat");
    const chunk = spawnEncounter(sim);
    for (const enemy of sim.enemies.values()) enemy.entity.hp = 0;
    resolveDeaths(sim);
    expect(spawnMiniBossEncounter(sim, chunk.x, chunk.y)).toBe(false);
  });

  it("keeps the warlord and its guards inside their home room", () => {
    const sim = createTestSim("mini-boss-leash");
    spawnEncounter(sim);
    const home = requireWarlord(sim).home;
    if (!home) throw new Error("warlord lacks home room");
    addBaitPlayer(sim, home);
    for (let tick = 0; tick < 200; tick++) stepEnemies(sim, []);
    for (const enemy of sim.enemies.values()) assertEnemyInHome(enemy, home);
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

function addBaitPlayer(sim: SimState, home: NonNullable<EnemySlot["home"]>): void {
  const bait = makeEntity("player", createBody(home.x1 + 2.5, (home.y0 + home.y1) / 2, 0), { id: "bait", hp: 100, maxHp: 100 });
  sim.players.set("bait", { entity: bait, connected: true, downedAtTick: null, spawnGraceUntilTick: 0 } as PlayerSlot);
}

function assertRoomInChunk(room: { x0: number; x1: number; y0: number; y1: number; area: number }): void {
  expect(room.x0).toBeGreaterThanOrEqual(2 * CHUNK_SIZE);
  expect(room.x1).toBeLessThan(3 * CHUNK_SIZE);
  expect(room.y0).toBeGreaterThanOrEqual(-3 * CHUNK_SIZE);
  expect(room.y1).toBeLessThan(-2 * CHUNK_SIZE);
  expect(room.area).toBe((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1));
}
