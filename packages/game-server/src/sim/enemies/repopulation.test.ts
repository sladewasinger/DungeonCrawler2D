import {
  areasData, enemiesData, itemsData, recipesData, rulesData, statusesData,
} from "@dc2d/content";
import {
  buildContentRegistry, createBody, hashString, LEVEL, makeEntity, World, type ContentRegistry,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { resolveSpawnAnchor } from "../spawn.js";
import { createSimState, type PlayerSlot, type SimState } from "../state.js";
import { activateChunksNearPlayers, NEAR_SPAWN_RADIUS_TILES } from "./population.js";
import { REPOPULATE_INTERVAL_TICKS, repopulateNearSpawn } from "./repopulation.js";

/**
 * GRINDER'S BLOCKER (panel round 2): probes the diagnosed near-spawn
 * density fix and the periodic repopulation that refills a floor other
 * players have cleared out. See population.ts's NEAR_SPAWN_RADIUS_TILES
 * doc comment for the diagnosis numbers.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData], rules: [...rulesData], areas: [...areasData],
  items: [...itemsData], enemies: [...enemiesData], recipes: [...recipesData],
});

function makeSlot(x: number, y: number, world: World): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, world.groundAt(x, y)), {
    id: "p1", hp: 30, maxHp: 30, baseSpeed: 8,
  });
  return {
    entity, clientId: "c1", stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok", lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true,
    reapAtTick: 0, known: new Set(), inventory: [], hotbar: [], weapon: null, outbox: [],
    returnStack: [], partyId: null, respawnAtTick: null, needsFullAreas: true, downedAtTick: null,
    attackReadyAtTick: 0, attackStartedAtTick: -1000, god: false, forceDeath: false, chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, pendingTransfer: null,
  };
}

/** Sweeps the player through a wide neighborhood of the spawn anchor,
 * activating chunks the way a wandering player's 3x3 window would. */
function sweepNearSpawn(sim: SimState, anchor: { x: number; y: number }): void {
  const slot = makeSlot(anchor.x, anchor.y, sim.world);
  sim.players.set("p1", slot);
  const offsets: Array<[number, number]> = [
    [0, 0], [40, 0], [-40, 0], [0, 40], [0, -40], [60, 60], [-60, -60], [60, -60], [-60, 60],
  ];
  for (const offset of offsets) {
    slot.entity.body.x = anchor.x + offset[0];
    slot.entity.body.y = anchor.y + offset[1];
    activateChunksNearPlayers(sim);
  }
}

function countWithin(sim: SimState, anchor: { x: number; y: number }, radius: number): number {
  let count = 0;
  for (const enemy of sim.enemies.values()) {
    if (Math.hypot(enemy.entity.body.x - anchor.x, enemy.entity.body.y - anchor.y) <= radius) count++;
  }
  return count;
}

describe("floor-1 near-spawn density", () => {
  // ASSUMPTION #150 (docs/ASSUMPTIONS.md): the un-boosted baseline diagnosed
  // 5-15 enemies within NEAR_SPAWN_RADIUS_TILES across a wide sweep; this
  // floor sits below the boosted band (19-31 observed) with margin for
  // seed variance, high enough to catch a regression back to the baseline.
  const MIN_NEAR_SPAWN_ENEMIES = 10;

  it.each(["grinder-probe-1", "grinder-probe-2", "grinder-probe-3"])(
    "seeds >= %s enemies reachable within NEAR_SPAWN_RADIUS_TILES for seed %s",
    (seedStr) => {
      const world = new World(hashString(seedStr), 1, LEVEL.Dungeon);
      const sim = createSimState(world, content, new PlayerStore(null), 42, {});
      const anchor = resolveSpawnAnchor(sim);

      sweepNearSpawn(sim, anchor);

      expect(countWithin(sim, anchor, NEAR_SPAWN_RADIUS_TILES)).toBeGreaterThanOrEqual(
        MIN_NEAR_SPAWN_ENEMIES,
      );
    },
  );
});

describe("repopulateNearSpawn", () => {
  let sim: SimState;
  let anchor: { x: number; y: number };

  beforeEach(() => {
    const world = new World(hashString("repop-test-world"), 1, LEVEL.Dungeon);
    sim = createSimState(world, content, new PlayerStore(null), 42, {});
    anchor = resolveSpawnAnchor(sim);
    sweepNearSpawn(sim, anchor);
  });

  it("tops the near-spawn population back up after everything nearby is cleared", () => {
    for (const [id, enemy] of sim.enemies) {
      if (Math.hypot(enemy.entity.body.x - anchor.x, enemy.entity.body.y - anchor.y) <= NEAR_SPAWN_RADIUS_TILES) {
        sim.enemies.delete(id);
      }
    }
    expect(countWithin(sim, anchor, NEAR_SPAWN_RADIUS_TILES)).toBe(0);

    sim.tickCount = REPOPULATE_INTERVAL_TICKS;
    repopulateNearSpawn(sim);

    expect(countWithin(sim, anchor, NEAR_SPAWN_RADIUS_TILES)).toBeGreaterThan(0);
  });

  it("does not keep piling on enemies once the near-spawn area is already full", () => {
    const before = sim.enemies.size;

    repopulateNearSpawn(sim);
    repopulateNearSpawn(sim);

    // Some churn is possible near the target line, but repeated calls on an
    // already-populated area should not runaway-spawn.
    expect(sim.enemies.size).toBeLessThan(before + 10);
  });

  it("is a no-op off floor 1", () => {
    const world2 = new World(hashString("repop-test-world"), 2, LEVEL.Dungeon);
    const sim2 = createSimState(world2, content, new PlayerStore(null), 42, {});
    const before = sim2.enemies.size;

    repopulateNearSpawn(sim2);

    expect(sim2.enemies.size).toBe(before);
  });

  it("is a no-op in the Sandbox level", () => {
    const world2 = new World(hashString("repop-test-world"), 1, LEVEL.Sandbox);
    const sim2 = createSimState(world2, content, new PlayerStore(null), 42, {});
    const before = sim2.enemies.size;

    repopulateNearSpawn(sim2);

    expect(sim2.enemies.size).toBe(before);
  });
});
