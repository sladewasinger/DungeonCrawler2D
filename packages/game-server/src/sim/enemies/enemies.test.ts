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
  CHASM_DEATH_Z,
  hashString,
  LEVEL,
  makeEntity,
  TILE,
  World,
  createBody,
  type ContentRegistry,
  type EffectEvent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../helpers.js";
import { createSimState, type PlayerSlot, type SimState } from "../state.js";
import { PlayerStore } from "../../store.js";
import { resolveDeaths } from "../deaths.js";
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

function makePlayerSlot(x: number, y: number, sim: SimState, id = "p1"): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, sim.world.groundAt(x, y)), {
    id,
    hp: 30,
    maxHp: 30,
    baseSpeed: 8,
  });
  return {
    entity,
    clientId: `c-${id}`,
    stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok",
    lastSeq: 0,
    pendingInputs: [], pendingActions: [],
    connected: true, reapAtTick: 0,
    known: new Set(), inventory: [], hotbar: [],
    weapon: null, outbox: [], returnStack: [],
    partyId: null, respawnAtTick: null, needsFullAreas: true,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: -1000,
    god: false, forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
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
      expect(sim.world.heightAt(tx, ty)).toBeGreaterThan(CHASM_DEATH_Z);
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
    const slot = sim.players.get("p1");
    if (!slot) throw new Error("missing melee player fixture");
    const player = slot.entity;
    const startHp = player.hp;

    stepEnemies(sim, []);

    expect(player.hp).toBeLessThan(startHp);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("fully blocks melee damage, status effects, and knockback with a weapon", () => {
    const enemy = spawnEnemy(sim, "skeleton", spot.x + 0.8, spot.y);
    const slot = sim.players.get("p1");
    if (!slot) throw new Error("missing blocking player fixture");
    slot.weapon = "sword";
    slot.blocking = true;
    const startHp = slot.entity.hp;
    const startBody = { ...slot.entity.body };
    const effects: EffectEvent[] = [];

    stepEnemies(sim, effects);

    expect(slot.entity.hp).toBe(startHp);
    expect(slot.entity.statuses).toEqual([]);
    expect(slot.entity.body.kx).toBe(startBody.kx);
    expect(slot.entity.body.ky).toBe(startBody.ky);
    expect(effects).toEqual([]);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("a spitter winds up, then launches a projectile", () => {
    const entity = spawnEnemy(sim, "spitter", spot.x + 4, spot.y);
    stepEnemies(sim, []); // enter windup
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing spitter fixture");
    expect(enemy.animation.state).toBe("windup");

    for (let i = 0; i < 5; i++) stepEnemies(sim, []);

    expect(enemy.animation.state).toBe("spit");
    expect(sim.projectiles.size).toBe(1);
  });

  it("cancels a windup and resumes wandering when its target is downed", () => {
    const entity = spawnEnemy(sim, "spitter", spot.x + 4, spot.y);
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const player = sim.players.get("p1");
    if (!enemy || !player) throw new Error("missing target lifecycle fixture");
    expect(enemy.animation.state).toBe("windup");

    player.entity.hp = 0;
    resolveDeaths(sim);
    expect(enemy.brain.targetId).toBeNull();
    enemy.brain.wanderDir = { moveX: 1, moveY: 0, jump: false };
    enemy.brain.wanderLeft = 1;
    stepEnemies(sim, []);
    expect(enemy.brain.wanderLeft).toBeLessThan(1);
  });

  it("abandons a dead target and reacquires the nearest living player", () => {
    const living = makePlayerSlot(spot.x + 3, spot.y, sim, "p2");
    sim.players.set(living.entity.id, living);
    const entity = spawnEnemy(sim, "slime", spot.x + 1, spot.y);
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const dead = sim.players.get("p1");
    if (!enemy || !dead) throw new Error("missing reacquisition fixture");
    expect(enemy.brain.targetId).toBe(dead.entity.id);
    dead.entity.hp = 0;
    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBe(living.entity.id);
  });
});
