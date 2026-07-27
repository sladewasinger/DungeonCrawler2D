import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  CHASM_DEATH_Z,
  LEVEL,
  PLAYER_MAX_HP,
  World,
  buildContentRegistry,
  hashString,
  type ContentRegistry,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { spawnEnemy } from "./helpers.js";
import { addPlayer } from "./join.js";
import { reapAndRespawn } from "./players.js";
import { resolveSpawnAnchor } from "./spawn.js";
import { SPAWN_CLEARANCE_RADIUS, SPAWN_GRACE_TICKS } from "./spawnSafety.js";
import { assertLiveGraceCase } from "./spawnSafety/fuzzSupport.js";
import { createSimState, type SimState } from "./state.js";

/**
 * Multi-seed spawn-safety sweep. Two layers:
 *  1. HANDOFF (panel round 3b blocker #1): across 20 worlds, blanket the
 *     spawn neighborhood with hostiles, join/die/respawn, and assert the
 *     clearance radius + armed grace at the handoff instant.
 *  2. WHOLE-WINDOW (panel round 4, Grinder's drift-in leak): across 20
 *     worlds, run the REAL GameSim.step() tick loop and assert at EVERY
 *     graced tick — via the player's own replicated snapshot — that no
 *     hostile sits inside the radius and no damage lands before the
 *     first input, for both the join grace and the respawn grace.
 * Deliberately generous timeouts: 20 BSP worlds each is real work on slow CI.
 */

const SEED_COUNT = 20;
const FUZZ_TIMEOUT_MS = 180_000;

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

/** Park a slime on every 3rd walkable tile of the spawn neighborhood. */
function blanketHostiles(sim: SimState): number {
  const anchor = resolveSpawnAnchor(sim);
  let parked = 0;
  for (const tile of gridAround(anchor, 20, 3)) {
    if (!isHostileFloor(sim.world, tile)) continue;
    spawnEnemy(sim, { defId: "slime", x: tile.x + 0.5, y: tile.y + 0.5 });
    parked++;
  }
  return parked;
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

function nearestHostileDistance(sim: SimState, x: number, y: number): number {
  let nearest = Infinity;
  for (const enemy of sim.enemies.values()) {
    nearest = Math.min(nearest, Math.hypot(enemy.entity.body.x - x, enemy.entity.body.y - y));
  }
  return nearest;
}

describe("spawn safety across seeds", () => {
  it(
    `join + die + respawn hands over hostile-clear and grace-armed on ${SEED_COUNT} seeds`,
    () => {
      for (let seed = 1; seed <= SEED_COUNT; seed++) {
        const world = new World(hashString(`spawn-fuzz-${seed}`), 1, LEVEL.Dungeon);
        const sim = createSimState({ world, content, store: new PlayerStore(null), rngSeed: seed, opts: {
          spawnRadiusTiles: 12,
        } });
        expect(blanketHostiles(sim), `seed ${seed}: blanket too sparse`).toBeGreaterThan(10);

        // Handoff 1: fresh join.
        const join = addPlayer(sim, { name: "Fuzz", clientId: `client-${seed}` });
        const slot = sim.players.get(join.playerId)!;
        expect(
          nearestHostileDistance(sim, join.spawn.x, join.spawn.y),
          `seed ${seed}: hostile inside clearance at join`,
        ).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
        expect(slot.spawnGraceUntilTick).toBe(sim.tickCount + SPAWN_GRACE_TICKS);

        // Handoff 2: death respawn.
        slot.entity.hp = 0;
        slot.respawnAtTick = sim.tickCount;
        reapAndRespawn(sim);
        const { x, y } = slot.entity.body;
        expect(
          nearestHostileDistance(sim, x, y),
          `seed ${seed}: hostile inside clearance at respawn`,
        ).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_RADIUS);
        expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
        expect(slot.spawnGraceUntilTick).toBe(sim.tickCount + SPAWN_GRACE_TICKS);
      }
    },
    FUZZ_TIMEOUT_MS,
  );

  it(
    `the clearance invariant holds at EVERY graced tick under live pressure on ${SEED_COUNT} seeds (round 4)`,
    () => {
      for (let seed = 1; seed <= SEED_COUNT; seed++) assertLiveGraceCase({ content, seed });
    },
    FUZZ_TIMEOUT_MS,
  );
});
