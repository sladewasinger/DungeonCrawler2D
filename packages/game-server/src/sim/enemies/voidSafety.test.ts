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
  CHUNK_SIZE,
  hashString,
  LEVEL,
  makeEntity,
  TILE,
  World,
  createBody,
  type ContentRegistry,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveDeaths } from "../deaths.js";
import { spawnEnemy } from "../helpers.js";
import { createSimState, type PlayerSlot, type SimState } from "../state.js";
import { PlayerStore } from "../../store.js";
import { activateChunksNearPlayers, stepEnemies } from "./index.js";

/**
 * Multi-seed regression for the "enemies in the void" playtest defect
 * (Epic 7.13): population must never seed an enemy into a chasm/wall
 * cell, and any enemy that ends up in one anyway (chased or knocked in)
 * must die by the same ruling a player would, not stand there forever —
 * including a ranged enemy that's locked into its shoot decision, which
 * used to bypass the death check entirely (see ai.ts's stepEnemies).
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

const SEEDS = ["void-safety-a", "void-safety-b", "void-safety-c"];
/** A wide, deterministic grid of anchors — population is RNG-per-chunk
 * but chunk *selection* here is not, so this reliably samples many
 * chunks per seed rather than hoping a few random player walks touch a
 * rift. */
const ANCHOR_STRIDE_CHUNKS = 3;
const ANCHOR_GRID_RADIUS_CHUNKS = 6;

function makeScoutSlot(x: number, y: number, sim: SimState): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, sim.world.groundAt(x, y)), {
    id: "scout",
    hp: 30,
    maxHp: 30,
    baseSpeed: 8,
  });
  return {
    entity,
    clientId: "scout-client",
    stored: { slot: 0, name: "scout", stash: [], contacts: [] },
    resumeToken: "scout-token",
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

/** Every live enemy's tile must be walkable, non-wall, and above chasm depth. */
function assertNoEnemyInVoid(sim: SimState, label: string): void {
  for (const enemy of sim.enemies.values()) {
    const tx = Math.floor(enemy.entity.body.x);
    const ty = Math.floor(enemy.entity.body.y);
    const where = `${label}: enemy=${enemy.def.name} at (${tx},${ty})`;
    expect(sim.world.isWalkable(tx, ty), `${where}: not walkable`).toBe(true);
    expect(sim.world.tileAt(tx, ty), `${where}: on a wall`).not.toBe(TILE.Wall);
    expect(sim.world.heightAt(tx, ty), `${where}: at/below chasm depth`).toBeGreaterThan(CHASM_DEATH_Z);
  }
}

/** Any Floor tile at or below chasm depth, scanning outward from the
 * origin (mirrors sim/chasmDeath.test.ts's findChasmFloor). */
function findChasmFloor(world: World): { x: number; y: number } | null {
  for (let cx = -24; cx <= 24; cx++) {
    for (let cy = -24; cy <= 24; cy++) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const x = cx * CHUNK_SIZE + lx;
          const y = cy * CHUNK_SIZE + ly;
          if (world.tileAt(x, y) === TILE.Floor && world.heightAt(x, y) <= CHASM_DEATH_Z) return { x, y };
        }
      }
    }
  }
  return null;
}

describe("enemy void safety: population placement (multi-seed sweep)", () => {
  it.each(SEEDS)("never seeds an enemy onto a non-walkable or chasm tile — seed %s", (seed) => {
    const world = new World(hashString(seed), 1, LEVEL.Dungeon);
    const sim = createSimState(world, content, new PlayerStore(null), 99, {});
    const scout = makeScoutSlot(0, 0, sim);
    sim.players.set(scout.entity.id, scout);

    // Sweep a wide grid of chunk anchors so population runs against many
    // different chunks, not just the handful a short random walk would
    // touch — deterministic per seed, independent of AI/RNG luck.
    for (let gx = -ANCHOR_GRID_RADIUS_CHUNKS; gx <= ANCHOR_GRID_RADIUS_CHUNKS; gx += ANCHOR_STRIDE_CHUNKS) {
      for (let gy = -ANCHOR_GRID_RADIUS_CHUNKS; gy <= ANCHOR_GRID_RADIUS_CHUNKS; gy += ANCHOR_STRIDE_CHUNKS) {
        scout.entity.body.x = gx * CHUNK_SIZE + CHUNK_SIZE / 2;
        scout.entity.body.y = gy * CHUNK_SIZE + CHUNK_SIZE / 2;
        activateChunksNearPlayers(sim);
      }
    }

    assertNoEnemyInVoid(sim, `seed=${seed}`);
    expect(sim.enemies.size, "sanity: population should have placed at least one enemy").toBeGreaterThan(0);
  });
});

describe("enemy void safety: a ranged enemy locked into shooting still dies in a chasm", () => {
  it("a spitter placed directly in a rift, in range of a stationary player, dies on its first active tick", () => {
    const world = new World(hashString("void-safety-spitter"), 1, LEVEL.Dungeon);
    const sim = createSimState(world, content, new PlayerStore(null), 7, {});
    const rift = findChasmFloor(world);
    expect(rift, "no chasm floor found in scan range").not.toBeNull();
    if (!rift) return;

    // Player close enough to be within the spitter's aggroRadius (10)
    // and attack range (7), so enemyThink returns a `shoot` decision
    // every tick it's off cooldown — the exact branch that used to
    // `continue` past the chasm-death check entirely.
    const scout = makeScoutSlot(rift.x + 3.5, rift.y + 0.5, sim);
    sim.players.set(scout.entity.id, scout);

    const spitter = spawnEnemy(sim, "spitter", rift.x + 0.5, rift.y + 0.5);
    spitter.body.z = sim.world.heightAt(rift.x, rift.y);
    spitter.body.grounded = true;

    stepEnemies(sim, []);
    resolveDeaths(sim);

    expect(sim.enemies.has(spitter.id)).toBe(false);
  });
});
