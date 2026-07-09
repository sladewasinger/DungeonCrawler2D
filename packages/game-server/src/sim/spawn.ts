import { MIN_SPAWN_DIST, SPAWN_CHUNK_RANGE, TEST_SPAWN, TILE, chunkCenter } from "@dc2d/engine";
import type { SimState } from "./state";

/** Where new and respawning players appear. */

export function findSpawn(sim: SimState): { x: number; y: number; z: number } {
  // e2e scaffolding: everyone spawns side by side at the proving
  // ground (real spawns keep MIN_SPAWN_DIST — distance is the
  // protection; browser tests can't walk 80 tiles to meet).
  if (sim.opts.clusterSpawns) {
    const x = TEST_SPAWN.x + sim.players.size * 2;
    const y = TEST_SPAWN.y;
    return { x, y, z: sim.world.heightAt(Math.floor(x), Math.floor(y)) };
  }

  // Dev scaffolding: first player to fit lands at the proving ground.
  const test = { x: Math.floor(TEST_SPAWN.x), y: Math.floor(TEST_SPAWN.y) };
  if (sim.world.isWalkable(test.x, test.y)) {
    let nearest = Infinity;
    for (const other of sim.players.values()) {
      const d = Math.hypot(other.entity.body.x - TEST_SPAWN.x, other.entity.body.y - TEST_SPAWN.y);
      if (d < nearest) nearest = d;
    }
    if (nearest >= MIN_SPAWN_DIST) {
      return { x: TEST_SPAWN.x, y: TEST_SPAWN.y, z: sim.world.heightAt(test.x, test.y) };
    }
  }

  let best: { x: number; y: number } | null = null;
  let bestDist = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const cx = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
    const cy = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
    const center = chunkCenter(sim.world.worldSeed, sim.world.floor, cx, cy);
    const tile = findWalkableNear(sim, center.x, center.y);
    if (!tile) continue;
    let nearest = Infinity;
    for (const other of sim.players.values()) {
      const d = Math.hypot(other.entity.body.x - tile.x, other.entity.body.y - tile.y);
      if (d < nearest) nearest = d;
    }
    if (nearest >= MIN_SPAWN_DIST) {
      best = tile;
      break;
    }
    if (nearest > bestDist) {
      bestDist = nearest;
      best = tile;
    }
  }
  const spot = best ?? { x: 0.5, y: 0.5 };
  const x = spot.x + 0.5;
  const y = spot.y + 0.5;
  return { x, y, z: sim.world.heightAt(Math.floor(x), Math.floor(y)) };
}

export function findWalkableNear(
  sim: SimState,
  wx: number,
  wy: number,
): { x: number; y: number } | null {
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = Math.round(wx) + dx;
        const y = Math.round(wy) + dy;
        // Wall tops are technically standable, but nobody's first
        // moment should be marooned on one.
        if (sim.world.isWalkable(x, y) && sim.world.tileAt(x, y) !== TILE.Wall) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

export function newToken(sim: SimState): string {
  let token = "";
  for (let i = 0; i < 4; i++) {
    token += sim.rng.next().toString(36).slice(2, 10);
  }
  return token + Date.now().toString(36);
}
