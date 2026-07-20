import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  buildContentRegistry,
  hashString,
  LEVEL,
  makeEntity,
  TILE,
  World,
  createBody,
  type ContentRegistry,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../helpers.js";
import { createSimState, type PlayerSlot, type SimState } from "../state.js";
import { PlayerStore } from "../../store.js";
import { populateTestZoneChunk } from "../testzone.js";
import { activateChunksNearPlayers, stepEnemies } from "./index.js";

/** Headless tests for the enemy subsystem: population placement and per-tick AI. */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});
const SEED = hashString("enemies-test-world");

/** Scan outward from (0,0) for a walkable, non-wall, non-sanctuary tile —
 * robust to worldgen changes, unlike hardcoded coordinates. */
function findOpenFloor(sim: SimState): { x: number; y: number } {
  for (let radius = 0; radius < 64; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = 200 + dx;
        const y = 200 + dy;
        if (
          sim.world.isWalkable(x, y) &&
          sim.world.tileAt(x, y) !== TILE.Wall &&
          !sim.world.isSanctuary(x, y)
        ) {
          return { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
  }
  throw new Error("no open floor found near (200, 200)");
}

function makePlayerSlot(x: number, y: number, sim: SimState): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, sim.world.groundAt(x, y)), {
    id: "p1",
    hp: 30,
    maxHp: 30,
    baseSpeed: 8,
  });
  return {
    entity,
    clientId: "c1",
    stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok",
    lastSeq: 0,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: 0,
    known: new Set(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: -1000,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity,
  };
}

describe("enemy population", () => {
  let sim: SimState;

  beforeEach(() => {
    const world = new World(SEED, 1, LEVEL.Dungeon);
    sim = createSimState(world, content, new PlayerStore(null), 42, {});
  });

  it("only spawns enemies on walkable, non-sanctuary, non-wall tiles", () => {
    const spot = findOpenFloor(sim);
    sim.players.set("p1", makePlayerSlot(spot.x, spot.y, sim));

    activateChunksNearPlayers(sim);

    expect(sim.enemies.size).toBeGreaterThan(0);
    for (const enemy of sim.enemies.values()) {
      const tx = Math.floor(enemy.entity.body.x);
      const ty = Math.floor(enemy.entity.body.y);
      expect(sim.world.isWalkable(tx, ty)).toBe(true);
      expect(sim.world.isSanctuary(tx, ty)).toBe(false);
      expect(sim.world.tileAt(tx, ty)).not.toBe(TILE.Wall);
    }
  });

  it("does not re-populate an already-activated chunk", () => {
    const spot = findOpenFloor(sim);
    sim.players.set("p1", makePlayerSlot(spot.x, spot.y, sim));

    activateChunksNearPlayers(sim);
    const first = sim.enemies.size;
    activateChunksNearPlayers(sim);

    expect(sim.enemies.size).toBe(first);
  });

  it("test-fixture chunks place the canonical roster instead of random spawns", () => {
    const world = new World(SEED, 1, LEVEL.Sandbox);
    const fixtureSim = createSimState(world, content, new PlayerStore(null), 42, {
      testFixtures: true,
    });
    const placed = populateTestZoneChunk(fixtureSim, 0, 0);
    expect(placed).toBe(true);
    expect(fixtureSim.enemies.size).toBeGreaterThan(0);
    expect(populateTestZoneChunk(fixtureSim, 5, 5)).toBe(false);
  });
});

describe("enemy AI", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    const world = new World(SEED, 1, LEVEL.Dungeon);
    sim = createSimState(world, content, new PlayerStore(null), 42, {});
    spot = findOpenFloor(sim);
    sim.players.set("p1", makePlayerSlot(spot.x, spot.y, sim));
  });

  it("freezes enemies with no player within ENEMY_ACTIVE_RADIUS", () => {
    const enemy = spawnEnemy(sim, "slime", spot.x + 1000, spot.y + 1000);
    const before = { x: enemy.body.x, y: enemy.body.y };

    stepEnemies(sim, []);

    expect(enemy.body.x).toBe(before.x);
    expect(enemy.body.y).toBe(before.y);
  });

  it("strikes an adjacent player once in melee range", () => {
    const enemy = spawnEnemy(sim, "skeleton", spot.x + 0.8, spot.y);
    const player = sim.players.get("p1")!.entity; // set in beforeEach, above
    const startHp = player.hp;

    stepEnemies(sim, []);

    expect(player.hp).toBeLessThan(startHp);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("a spitter winds up, then launches a projectile", () => {
    spawnEnemy(sim, "spitter", spot.x + 4, spot.y);

    stepEnemies(sim, []); // enter windup
    const enemy = [...sim.enemies.values()][0]!; // the one spawnEnemy call above
    expect(enemy.animation.state).toBe("windup");

    for (let i = 0; i < 5; i++) stepEnemies(sim, []);

    expect(enemy.animation.state).toBe("spit");
    expect(sim.projectiles.size).toBe(1);
  });
});
