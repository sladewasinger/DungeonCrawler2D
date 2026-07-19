import { LEVEL, MIN_SPAWN_DIST, SPAWN_CHUNK_RANGE, TILE, chunkCenter } from "@dc2d/engine";
import type { SimState } from "./state.js";

/**
 * Spawn-point selection: candidates are floor tiles inside the BSP
 * generator's rooms/corridors (not walls, not furniture). Three modes,
 * checked in this order:
 *
 *  1. `clusterSpawns` (or the Sandbox level) — the tests'/e2e tight-cluster
 *     mode: a fixed grid a couple tiles apart around a hardcoded anchor,
 *     snapped to real floor via `findWalkableNear` (mirrors v1's
 *     SANDBOX_SPAWN clustering, but re-resolved against whatever floor the
 *     live BSP generator puts there — never a hardcoded tile, since v1's
 *     hand-authored sandbox chunk no longer exists; see
 *     docs/PORT_PLAN.md's worldgen redesign). Wins over spawnRadiusTiles
 *     when both are set: it exists for deterministic test/e2e geometry,
 *     not gameplay, so it stays authoritative regardless of gameplay opts.
 *  2. `spawnRadiusTiles` — the friend-playtest gameplay mode (see
 *     main.ts's SPAWN_RADIUS doc comment): every join and respawn lands
 *     within N tiles of a seed-derived anchor near the world origin, at
 *     least RADIUS_SPAWN_MIN_SPACING apart from other players, relaxing
 *     that spacing if the neighborhood gets crowded.
 *  3. Classic vast scatter (default: neither option set) — random chunk
 *     centers out to SPAWN_CHUNK_RANGE, scored by MIN_SPAWN_DIST from
 *     other players.
 */
const SANDBOX_ANCHOR = { x: 28, y: 28 };
const SANDBOX_CLUSTER_SPACING = 2;
const SANDBOX_CLUSTER_COLUMNS = 4;

/** Radius-mode target spacing between concurrent players; halves under crowding. */
export const RADIUS_SPAWN_MIN_SPACING = 6;
// Still 3x the physical overlap threshold (2 * engine's BODY_RADIUS = 0.5),
// so even a fully-relaxed spawn never lands literally on top of someone.
export const RADIUS_SPAWN_SPACING_FLOOR = 1.5;
const RADIUS_SPAWN_ATTEMPTS = 40;
// Spiral search radius (tiles) for the one-time origin anchor — generously
// bigger than one chunk so it finds real corridor floor even if (0,0)
// itself lands inside solid rock between rooms.
const ANCHOR_SEARCH_RADIUS = 48;

export function findSpawn(sim: SimState): { x: number; y: number; z: number } {
  if (sim.world.level === LEVEL.Sandbox || sim.opts.clusterSpawns) return findClusteredSpawn(sim);
  const radiusTiles = sim.opts.spawnRadiusTiles;
  if (radiusTiles && radiusTiles > 0) return findRadiusSpawn(sim, radiusTiles);
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

/** Friend-playtest spawn: near a fixed seed-derived anchor, spaced from other players. */
function findRadiusSpawn(sim: SimState, radiusTiles: number): { x: number; y: number; z: number } {
  const anchor = resolveSpawnAnchor(sim);
  const tile = pickRadiusTile(sim, anchor, radiusTiles) ?? anchor;
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

/**
 * The radius-mode anchor: the nearest walkable floor tile to the world
 * origin. Depends only on `sim.world` (worldSeed + floor via the BSP
 * generator), never on player count, join order, or `sim.rng` — so it is
 * byte-identical on every server restart for a given seed.
 */
export function resolveSpawnAnchor(sim: SimState): { x: number; y: number } {
  return findWalkableNear(sim, 0, 0, ANCHOR_SEARCH_RADIUS) ?? { x: 0, y: 0 };
}

/** Random floor candidate within radiusTiles of anchor, relaxing min spacing if crowded. */
function pickRadiusTile(
  sim: SimState,
  anchor: { x: number; y: number },
  radiusTiles: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = -1;
  for (let spacing = RADIUS_SPAWN_MIN_SPACING; spacing >= RADIUS_SPAWN_SPACING_FLOOR; spacing /= 2) {
    for (let attempt = 0; attempt < RADIUS_SPAWN_ATTEMPTS; attempt++) {
      const sample = sampleWithinRadius(sim, anchor, radiusTiles);
      const tile = findWalkableNear(sim, sample.x, sample.y);
      if (!tile || Math.hypot(tile.x - anchor.x, tile.y - anchor.y) > radiusTiles) continue;
      const nearest = nearestPlayerDistance(sim, tile);
      if (nearest >= spacing) return tile;
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = tile;
      }
    }
  }
  return best;
}

/** Uniform-area random point within radiusTiles of the anchor. */
function sampleWithinRadius(
  sim: SimState,
  anchor: { x: number; y: number },
  radiusTiles: number,
): { x: number; y: number } {
  const angle = sim.rng.next() * Math.PI * 2;
  const dist = Math.sqrt(sim.rng.next()) * radiusTiles;
  return { x: anchor.x + Math.cos(angle) * dist, y: anchor.y + Math.sin(angle) * dist };
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
  maxRadius = 6,
): { x: number; y: number } | null {
  for (let radius = 0; radius < maxRadius; radius++) {
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
