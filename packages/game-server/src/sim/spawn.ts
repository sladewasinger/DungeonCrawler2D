import { LEVEL, MIN_SPAWN_DIST, SPAWN_CHUNK_RANGE, TILE, chunkCenter } from "@dc2d/engine";
import type { SimState } from "./state.js";

/**
 * Spawn-point selection: candidates are floor tiles inside the BSP
 * generator's rooms/corridors (not walls, not furniture), sampled around
 * random chunk centers and scored by distance from other players.
 *
 * The sandbox level is a shared proving ground, not a scattered dungeon
 * run: players cluster near a fixed anchor instead (mirrors v1's
 * SANDBOX_SPAWN clustering), but the anchor is re-resolved against
 * whatever floor the live BSP generator puts there via
 * `findWalkableNear` — never a hardcoded tile, since v1's hand-authored
 * sandbox chunk no longer exists (see docs/PORT_PLAN.md's worldgen
 * redesign). This also fixes `clusterSpawns` — threaded through
 * server.ts/main.ts as an e2e-clustering option but never actually
 * consumed here — by honoring it for every level, not just sandbox.
 */
const SANDBOX_ANCHOR = { x: 28, y: 28 };
const SANDBOX_CLUSTER_SPACING = 2;
const SANDBOX_CLUSTER_COLUMNS = 4;

export function findSpawn(sim: SimState): { x: number; y: number; z: number } {
  if (sim.world.level === LEVEL.Sandbox || sim.opts.clusterSpawns) return findClusteredSpawn(sim);
  const spot = pickSpawnTile(sim) ?? { x: 0.5, y: 0.5 };
  const x = spot.x + 0.5;
  const y = spot.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

/** Grid-clustered spawn around a fixed anchor, snapped to the nearest real floor tile. */
function findClusteredSpawn(sim: SimState): { x: number; y: number; z: number } {
  const index = sim.players.size;
  const ox = SANDBOX_ANCHOR.x + (index % SANDBOX_CLUSTER_COLUMNS) * SANDBOX_CLUSTER_SPACING;
  const oy = SANDBOX_ANCHOR.y + Math.floor(index / SANDBOX_CLUSTER_COLUMNS) * SANDBOX_CLUSTER_SPACING;
  const tile = findWalkableNear(sim, ox, oy) ?? findWalkableNear(sim, SANDBOX_ANCHOR.x, SANDBOX_ANCHOR.y) ?? SANDBOX_ANCHOR;
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

function pickSpawnTile(sim: SimState): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const cx = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
    const cy = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
    const center = chunkCenter(sim.world.worldSeed, sim.world.floor, cx, cy);
    const tile = findWalkableNear(sim, center.x, center.y);
    if (!tile) continue;
    const nearest = nearestPlayerDistance(sim, tile);
    if (nearest >= MIN_SPAWN_DIST) return tile;
    if (nearest > bestDistance) {
      bestDistance = nearest;
      best = tile;
    }
  }
  return best;
}

function nearestPlayerDistance(sim: SimState, tile: { x: number; y: number }): number {
  let nearest = Infinity;
  for (const other of sim.players.values()) {
    nearest = Math.min(nearest, Math.hypot(other.entity.body.x - tile.x, other.entity.body.y - tile.y));
  }
  return nearest;
}

/** Nearest room/corridor floor tile to a world position (spiral search). */
export function findWalkableNear(
  sim: SimState,
  wx: number,
  wy: number,
): { x: number; y: number } | null {
  for (let radius = 0; radius < 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = Math.round(wx) + dx;
        const y = Math.round(wy) + dy;
        if (sim.world.isWalkable(x, y) && sim.world.tileAt(x, y) !== TILE.Wall) return { x, y };
      }
    }
  }
  return null;
}

export function newToken(sim: SimState): string {
  let token = "";
  for (let i = 0; i < 4; i++) token += sim.rng.next().toString(36).slice(2, 10);
  return token + Date.now().toString(36);
}
