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
import { createSimState, type SimState } from "./state.js";

/**
 * Multi-seed spawn-safety sweep (panel round 3b blocker #1): across 20
 * different worlds, blanket the spawn neighborhood with hostiles, then
 * join, die, and respawn — asserting the no-hostile clearance radius
 * and an armed grace window at EVERY control handoff. Deliberately
 * generous timeout: 20 BSP worlds is real work on slow CI.
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
  for (let y = anchor.y - 20; y <= anchor.y + 20; y += 3) {
    for (let x = anchor.x - 20; x <= anchor.x + 20; x += 3) {
      if (!sim.world.isWalkable(x, y) || sim.world.isSanctuary(x, y)) continue;
      if (sim.world.heightAt(x, y) <= CHASM_DEATH_Z) continue;
      spawnEnemy(sim, "slime", x + 0.5, y + 0.5);
      parked++;
    }
  }
  return parked;
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
        const sim = createSimState(world, content, new PlayerStore(null), seed, {
          spawnRadiusTiles: 12,
        });
        expect(blanketHostiles(sim), `seed ${seed}: blanket too sparse`).toBeGreaterThan(10);

        // Handoff 1: fresh join.
        const join = addPlayer(sim, "Fuzz", `client-${seed}`);
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
});
