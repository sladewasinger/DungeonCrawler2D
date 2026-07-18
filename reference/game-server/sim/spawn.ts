import {
  LEVEL,
  MIN_SPAWN_DIST,
  SPAWN_CHUNK_RANGE,
  TILE,
  chunkCenter,
} from "@dc2d/engine";
import { SANDBOX_SPAWN } from "@dc2d/engine";
import type { SimState } from "./state";

export function findSpawn(sim: SimState): { x: number; y: number; z: number } {
  if (sim.world.level === LEVEL.Sandbox) {
    const index = sim.players.size;
    const x = SANDBOX_SPAWN.x + (index % 4) * 2;
    const y = SANDBOX_SPAWN.y + Math.floor(index / 4) * 2;
    return { x, y, z: sim.world.groundAt(x, y) };
  }

  let best: { x: number; y: number } | null = null;
  let bestDistance = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const cx = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
    const cy = sim.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
    const center = chunkCenter(sim.world.worldSeed, sim.world.floor, cx, cy);
    const tile = findWalkableNear(sim, center.x, center.y);
    if (!tile) continue;
    let nearest = Infinity;
    for (const other of sim.players.values()) {
      nearest = Math.min(nearest, Math.hypot(other.entity.body.x - tile.x, other.entity.body.y - tile.y));
    }
    if (nearest >= MIN_SPAWN_DIST) {
      best = tile;
      break;
    }
    if (nearest > bestDistance) {
      bestDistance = nearest;
      best = tile;
    }
  }
  const spot = best ?? { x: 0.5, y: 0.5 };
  const x = spot.x + 0.5;
  const y = spot.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

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
