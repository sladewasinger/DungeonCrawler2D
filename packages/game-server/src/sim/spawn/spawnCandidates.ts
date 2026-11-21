import { MIN_SPAWN_DIST, populationAnchorForChunk, SPAWN_CHUNK_RANGE } from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { findWalkableNear } from "./search.js";

export function pickSpawnTile(sim: SimState): { x: number; y: number } | null {
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
  const world = { worldSeed: sim.world.worldSeed, floor: sim.world.floor, generatedFloor: sim.world.generatedFloor };
  const anchor = populationAnchorForChunk({ ...world, cx: chunkX, cy: chunkY });
  if (!anchor) return null;
  const tile = findWalkableNear({ sim, ...anchor });
  return tile ? { tile, distance: nearestPlayerDistance(sim, tile) } : null;
}

export function nearestPlayerDistance(sim: SimState, tile: { x: number; y: number }): number {
  let nearest = Infinity;
  for (const other of sim.players.values()) {
    if (!other.connected) continue;
    nearest = Math.min(nearest, Math.hypot(other.entity.body.x - tile.x, other.entity.body.y - tile.y));
  }
  return nearest;
}
