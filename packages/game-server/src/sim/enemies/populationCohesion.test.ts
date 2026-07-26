import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  BIOME,
  CHUNK_SIZE,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  populationRoomsForChunk,
  World,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { resolveDeaths } from "../deaths.js";
import { createSimState } from "../state.js";
import type { PlayerSlot } from "../state.js";
import {
  MINI_BOSS_MIN_ROOM_AREA,
  spawnMiniBossEncounter,
} from "./miniBossPopulation.js";
import { spawnEnemyPack } from "./population.js";
import { enemyRosterForBiome } from "./populationRoster.js";
import { stepEnemies } from "./ai.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function createTestSim(seed = "cohesive-population") {
  const worldSeed = hashString(seed);
  return createSimState(
    new World(worldSeed, 1),
    content,
    new PlayerStore(null),
    worldSeed,
    {},
  );
}

describe("cohesive district enemy population", () => {
  it("assigns a narrow native roster to every biome", () => {
    for (const biome of Object.values(BIOME)) {
      const roster = enemyRosterForBiome(biome);
      expect(roster.length).toBeGreaterThanOrEqual(3);
      for (const defId of roster) expect(content.enemies.has(defId)).toBe(true);
    }
    expect(enemyRosterForBiome(BIOME.Pools)).toContain("slime");
    expect(enemyRosterForBiome(BIOME.Maze)).toContain("orc-warrior");
  });

  it("spawns a tight pack with at most one off-theme wanderer", () => {
    const sim = createTestSim();
    spawnEnemyPack(sim, 8, 8);
    const enemies = [...sim.enemies.values()];
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    const counts = new Map<string, number>();
    for (const enemy of enemies) {
      counts.set(enemy.def.id, (counts.get(enemy.def.id) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(enemies.length - 1);
    for (const a of enemies) {
      for (const b of enemies) {
        expect(Math.hypot(
          a.entity.body.x - b.entity.body.x,
          a.entity.body.y - b.entity.body.y,
        )).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("large-room orc mini bosses", () => {
  it("spawns one warlord and three guards entirely inside a large room", () => {
    const sim = createTestSim("mini-boss-rooms");
    let spawned = false;
    for (let cy = -8; cy <= 8 && !spawned; cy++) {
      for (let cx = -8; cx <= 8 && !spawned; cx++) {
        spawned = spawnMiniBossEncounter(sim, cx, cy);
      }
    }
    expect(spawned).toBe(true);
    const enemies = [...sim.enemies.values()];
    expect(enemies).toHaveLength(4);
    const warlord = enemies.find((enemy) => enemy.def.id === "orc-warlord");
    expect(warlord?.home).toBeDefined();
    const home = warlord!.home!;
    const area = (home.x1 - home.x0 + 1) * (home.y1 - home.y0 + 1);
    expect(area).toBeGreaterThanOrEqual(MINI_BOSS_MIN_ROOM_AREA);
    for (const enemy of enemies) {
      expect(enemy.home).toEqual(home);
      expect(enemy.entity.body.x).toBeGreaterThan(home.x0);
      expect(enemy.entity.body.x).toBeLessThan(home.x1 + 1);
      expect(enemy.entity.body.y).toBeGreaterThan(home.y0);
      expect(enemy.entity.body.y).toBeLessThan(home.y1 + 1);
    }
    expect(warlord!.def.hp).toBeGreaterThan(
      content.enemies.get("orc-warrior")!.hp * 3,
    );
  });

  it("does not respawn a defeated warlord in its room", () => {
    const sim = createTestSim("mini-boss-defeat");
    let chunk: { x: number; y: number } | null = null;
    for (let cy = -8; cy <= 8 && !chunk; cy++) {
      for (let cx = -8; cx <= 8 && !chunk; cx++) {
        if (spawnMiniBossEncounter(sim, cx, cy)) chunk = { x: cx, y: cy };
      }
    }
    const warlord = [...sim.enemies.values()].find(
      (enemy) => enemy.def.id === "orc-warlord",
    )!;
    warlord.entity.hp = 0;
    resolveDeaths(sim);
    expect(spawnMiniBossEncounter(sim, chunk!.x, chunk!.y)).toBe(false);
  });

  it("keeps the warlord and its guards inside their home room", () => {
    const sim = createTestSim("mini-boss-leash");
    for (let cy = -8; cy <= 8 && sim.enemies.size === 0; cy++) {
      for (let cx = -8; cx <= 8 && sim.enemies.size === 0; cx++) {
        spawnMiniBossEncounter(sim, cx, cy);
      }
    }
    const home = [...sim.enemies.values()][0]!.home!;
    const bait = makeEntity(
      "player",
      createBody(home.x1 + 2.5, (home.y0 + home.y1) / 2, 0),
      { id: "bait", hp: 100, maxHp: 100 },
    );
    sim.players.set("bait", {
      entity: bait,
      connected: true,
      downedAtTick: null,
      spawnGraceUntilTick: 0,
    } as PlayerSlot);
    for (let tick = 0; tick < 200; tick++) stepEnemies(sim, []);
    for (const enemy of sim.enemies.values()) {
      expect(enemy.entity.body.x).toBeGreaterThanOrEqual(home.x0);
      expect(enemy.entity.body.x).toBeLessThan(home.x1 + 1);
      expect(enemy.entity.body.y).toBeGreaterThanOrEqual(home.y0);
      expect(enemy.entity.body.y).toBeLessThan(home.y1 + 1);
    }
  });

  it("reports scaled room bounds inside their owning chunk", () => {
    const seed = hashString("room-bounds");
    const rooms = populationRoomsForChunk(seed, 1, 2, -3);
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.x0).toBeGreaterThanOrEqual(2 * CHUNK_SIZE);
      expect(room.x1).toBeLessThan(3 * CHUNK_SIZE);
      expect(room.y0).toBeGreaterThanOrEqual(-3 * CHUNK_SIZE);
      expect(room.y1).toBeLessThan(-2 * CHUNK_SIZE);
      expect(room.area).toBe((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1));
    }
  });
});
