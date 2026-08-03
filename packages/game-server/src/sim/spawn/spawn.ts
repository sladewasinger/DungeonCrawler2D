import {
  LEVEL,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";
export { findWalkableNear } from "./search.js";
import { findWalkableNear } from "./search.js";
import { findCombatSandboxSpawn } from "./combatSandboxSpawn.js";
import { nearestPlayerDistance, pickSpawnTile } from "./spawnCandidates.js";

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
  const spot = pickSpawnTile(sim) ?? floorSpawnTile(sim);
  const x = spot.x + 0.5;
  const y = spot.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

function findClusteredSpawn(sim: SimState): { x: number; y: number; z: number } {
  const index = sim.players.size;
  const ox = SANDBOX_ANCHOR.x + (index % SANDBOX_CLUSTER_COLUMNS) * SANDBOX_CLUSTER_SPACING;
  const oy = SANDBOX_ANCHOR.y + Math.floor(index / SANDBOX_CLUSTER_COLUMNS) * SANDBOX_CLUSTER_SPACING;
  const anchor = boundedAnchor(sim, { x: ox, y: oy });
  const tile = findWalkableNear({ sim, ...anchor }) ??
    findWalkableNear({ sim, ...boundedAnchor(sim, SANDBOX_ANCHOR) }) ??
    floorSpawnTile(sim);
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

function findRadiusSpawn(sim: SimState, radiusTiles: number): { x: number; y: number; z: number } {
  const anchor = resolveSpawnAnchor(sim);
  const tile = pickRadiusTile(sim, anchor, radiusTiles) ??
    requireWalkableNear({ sim, ...anchor, maxRadius: radiusTiles });
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

export function resolveSpawnAnchor(sim: SimState): { x: number; y: number } {
  return requireWalkableNear({ sim, ...boundedAnchor(sim, PLAYTEST_SPAWN_ANCHOR), maxRadius: ANCHOR_SEARCH_RADIUS });
}

function boundedAnchor(sim: SimState, requested: { x: number; y: number }): { x: number; y: number } {
  const bounds = sim.world.floorBounds;
  if (!bounds || requested.x >= bounds.minX && requested.x <= bounds.maxX
    && requested.y >= bounds.minY && requested.y <= bounds.maxY) return requested;
  const spawn = sim.world.generatedFloor?.spawn;
  if (!spawn) throw new Error("Finite floor has no bounded spawn anchor");
  return { x: Math.floor(spawn.x), y: Math.floor(spawn.y) };
}

function floorSpawnTile(sim: SimState): { x: number; y: number } {
  const spawn = sim.world.generatedFloor?.spawn;
  if (!spawn) throw new Error("Finite floor has no spawn point");
  return requireWalkableNear({ sim, x: Math.floor(spawn.x), y: Math.floor(spawn.y), maxRadius: 8 });
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

function sampleWithinRadius(
  sim: SimState,
  anchor: { x: number; y: number },
  radiusTiles: number,
): { x: number; y: number } {
  const angle = sim.rng.next() * Math.PI * 2;
  const dist = Math.sqrt(sim.rng.next()) * radiusTiles;
  return { x: anchor.x + Math.cos(angle) * dist, y: anchor.y + Math.sin(angle) * dist };
}

export function newToken(sim: SimState): string {
  let token = "";
  for (let i = 0; i < 4; i++) token += sim.rng.next().toString(36).slice(2, 10);
  return token + Date.now().toString(36);
}
