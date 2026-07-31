import {
  LEVEL,
  MIN_SPAWN_DIST,
  populationAnchorForChunk,
  SPAWN_CHUNK_RANGE,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";
export { findWalkableNear } from "./search.js";
import { findWalkableNear } from "./search.js";
import { findCombatSandboxSpawn } from "./combatSandboxSpawn.js";

/**
 * Spawn-point selection: candidates are floor tiles inside the BSP
 * generator's rooms/corridors (not walls, not furniture). Three modes,
 * checked in this order:
 *
 *  1. `clusterSpawns` (or the Sandbox level) — the tests'/e2e tight-cluster
 *     mode: a fixed grid a couple tiles apart around a hardcoded anchor,
 *     snapped to real floor via `findWalkableNear`. It is re-resolved against
 *     whatever floor the live BSP generator puts there, never a hardcoded tile.
 *     Wins over spawnRadiusTiles
 *     when both are set: it exists for deterministic test/e2e geometry,
 *     not gameplay, so it stays authoritative regardless of gameplay opts.
 *  2. `spawnRadiusTiles` — the friend-playtest gameplay mode (see
 *     main.ts's SPAWN_RADIUS doc comment): every join and respawn lands
 *     within N tiles of the fixed 3D playtest anchor, at
 *     least RADIUS_SPAWN_MIN_SPACING apart from other players, relaxing
 *     that spacing if the neighborhood gets crowded.
 *  3. Classic vast scatter (default: neither option set) — anchors in
 *     random generated rooms out to SPAWN_CHUNK_RANGE, scored by MIN_SPAWN_DIST from
 *     other players.
 */
const SANDBOX_ANCHOR = { x: 19, y: 24 };
const PLAYTEST_SPAWN_ANCHOR = { x: 14, y: 10 };
const SANDBOX_CLUSTER_SPACING = 2;
const SANDBOX_CLUSTER_COLUMNS = 4;

/** Radius-mode target spacing between concurrent players; halves under crowding. */
export const RADIUS_SPAWN_MIN_SPACING = 6; export const RADIUS_SPAWN_SPACING_FLOOR = 1.5;
const RADIUS_SPAWN_ATTEMPTS = 40; const ANCHOR_SEARCH_RADIUS = 48;
// Spiral search radius (tiles) for the one-time origin anchor — generously
// bigger than one chunk so it finds real corridor floor even if (0,0)
// itself lands inside an uncarved generator cell between rooms.

export function findSpawn(sim: SimState): { x: number; y: number; z: number } {
  if (sim.world.level === LEVEL.CombatSandbox) return findCombatSandboxSpawn(sim);
  if (sim.world.level === LEVEL.Sandbox || sim.opts.clusterSpawns) return findClusteredSpawn(sim);
  const radiusTiles = sim.opts.spawnRadiusTiles;
  if (radiusTiles && radiusTiles > 0) return findRadiusSpawn(sim, radiusTiles);
  const spot = pickSpawnTile(sim) ?? requireWalkableNear({ sim, x: 0, y: 0, maxRadius: ANCHOR_SEARCH_RADIUS });
  const x = spot.x + 0.5;
  const y = spot.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

/** Grid-clustered spawn around a fixed anchor, snapped to the nearest real floor tile. */
function findClusteredSpawn(sim: SimState): { x: number; y: number; z: number } {
  const index = sim.players.size;
  const ox = SANDBOX_ANCHOR.x + (index % SANDBOX_CLUSTER_COLUMNS) * SANDBOX_CLUSTER_SPACING;
  const oy = SANDBOX_ANCHOR.y + Math.floor(index / SANDBOX_CLUSTER_COLUMNS) * SANDBOX_CLUSTER_SPACING;
  const tile = findWalkableNear({ sim, x: ox, y: oy }) ??
    findWalkableNear({ sim, ...SANDBOX_ANCHOR }) ??
    requireWalkableNear({ sim, ...SANDBOX_ANCHOR, maxRadius: ANCHOR_SEARCH_RADIUS });
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

/** Friend-playtest spawn: near a fixed seed-derived anchor, spaced from other players. */
function findRadiusSpawn(sim: SimState, radiusTiles: number): { x: number; y: number; z: number } {
  const anchor = resolveSpawnAnchor(sim);
  const tile = pickRadiusTile(sim, anchor, radiusTiles) ??
    requireWalkableNear({ sim, ...anchor, maxRadius: radiusTiles });
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

/**
 * The radius-mode anchor: the nearest walkable floor tile to the fixed
 * 3D playtest coordinate. Depends only on `sim.world` (worldSeed + floor via the BSP
 * generator), never on player count, join order, or `sim.rng` — so it is
 * byte-identical on every server restart for a given seed.
 */
export function resolveSpawnAnchor(sim: SimState): { x: number; y: number } {
  return requireWalkableNear({ sim, ...PLAYTEST_SPAWN_ANCHOR, maxRadius: ANCHOR_SEARCH_RADIUS });
}

function requireWalkableNear(input: {
  readonly sim: Pick<SimState, "world">;
  readonly x: number;
  readonly y: number;
  readonly maxRadius: number;
}): { x: number; y: number } {
  const tile = findWalkableNear(input);
  if (tile) return tile;
  throw new Error(`No walkable spawn tile near (${input.x}, ${input.y})`);
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
    const result = sampleRadiusCandidates({ sim, anchor, radiusTiles, spacing });
    if (result.spaced) return result.spaced;
    if (result.bestDistance > bestDistance) ({ best, bestDistance } = result);
  }
  return best;
}

function sampleRadiusCandidates(input: { sim: SimState; anchor: { x: number; y: number }; radiusTiles: number; spacing: number }): {
  spaced: { x: number; y: number } | null;
  best: { x: number; y: number } | null;
  bestDistance: number;
} {
  let best: { x: number; y: number } | null = null;
  let bestDistance = -1;
  for (let attempt = 0; attempt < RADIUS_SPAWN_ATTEMPTS; attempt++) {
    const result = evaluateRadiusCandidate(input);
    if (result.spaced) return { spaced: result.spaced, best, bestDistance };
    if (result.bestDistance > bestDistance) ({ best, bestDistance } = result);
  }
  return { spaced: null, best, bestDistance };
}

function evaluateRadiusCandidate(input: Parameters<typeof sampleRadiusCandidates>[0]): {
  spaced: { x: number; y: number } | null;
  best: { x: number; y: number } | null;
  bestDistance: number;
} {
  const candidate = sampledRadiusCandidate(input);
  if (!candidate) return { spaced: null, best: null, bestDistance: -1 };
  const bestDistance = nearestPlayerDistance(input.sim, candidate);
  return bestDistance >= input.spacing
    ? { spaced: candidate, best: null, bestDistance }
    : { spaced: null, best: candidate, bestDistance };
}

function sampledRadiusCandidate({ sim, anchor, radiusTiles }: Pick<Parameters<typeof sampleRadiusCandidates>[0], "sim" | "anchor" | "radiusTiles">): { x: number; y: number } | null {
  const sample = sampleWithinRadius(sim, anchor, radiusTiles);
  const tile = findWalkableNear({ sim, ...sample });
  return tile && Math.hypot(tile.x - anchor.x, tile.y - anchor.y) <= radiusTiles ? tile : null;
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
    const result = evaluateSpawnCandidate(sim);
    if (result.spaced) return result.spaced;
    if (result.bestDistance > bestDistance) ({ best, bestDistance } = result);
  }
  return best;
}

function evaluateSpawnCandidate(sim: SimState): { spaced: { x: number; y: number } | null; best: { x: number; y: number } | null; bestDistance: number } {
  const chunkX = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
  const chunkY = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
  const candidate = spawnCandidate(sim, chunkX, chunkY);
  if (!candidate) return { spaced: null, best: null, bestDistance: -1 };
  return candidate.distance >= MIN_SPAWN_DIST
    ? { spaced: candidate.tile, best: null, bestDistance: candidate.distance }
    : { spaced: null, best: candidate.tile, bestDistance: candidate.distance };
}

function spawnCandidate(sim: SimState, chunkX: number, chunkY: number): { tile: { x: number; y: number }; distance: number } | null {
  const world = { worldSeed: sim.world.worldSeed, floor: sim.world.floor };
  const anchor = populationAnchorForChunk({ ...world, cx: chunkX, cy: chunkY });
  const tile = findWalkableNear({ sim, ...anchor });
  return tile ? { tile, distance: nearestPlayerDistance(sim, tile) } : null;
}

function nearestPlayerDistance(sim: SimState, tile: { x: number; y: number }): number {
  let nearest = Infinity;
  for (const other of sim.players.values()) {
    if (!other.connected) continue;
    nearest = Math.min(nearest, Math.hypot(other.entity.body.x - tile.x, other.entity.body.y - tile.y));
  }
  return nearest;
}

/**
 * Nearest room/corridor floor tile to a world position (spiral search).
 * `avoid` skips tiles a caller has already claimed this pass (e.g.
 * authored fixture snapping without stacking
 * them onto the same lone floor tile).
 */
export function newToken(sim: SimState): string {
  let token = "";
  for (let i = 0; i < 4; i++) token += sim.rng.next().toString(36).slice(2, 10);
  return token + Date.now().toString(36);
}
