import { CHASM_DEATH_Z, CHUNK_SIZE } from "@dc2d/engine";
import type { SimState } from "../state/state.js";

export interface SpawnBounds {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export function tooCloseToPlayer(sim: SimState, x: number, y: number): boolean {
  for (const slot of sim.players.values()) {
    if (Math.hypot(slot.entity.body.x - x, slot.entity.body.y - y) < 12) {
      return true;
    }
  }
  return false;
}

export function validEnemySpawn(sim: SimState, x: number, y: number): boolean {
  if (!sim.world.isWalkable(x, y) || sim.world.isSanctuary(x, y)) return false;
  if (sim.world.heightAt(x, y) <= CHASM_DEATH_Z) return false;
  return !tooCloseToPlayer(sim, x, y);
}

export function randomChunkSpot(
  sim: SimState,
  cx: number,
  cy: number,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 32; attempt++) {
    const x = cx * CHUNK_SIZE + Math.floor(sim.rng.next() * CHUNK_SIZE);
    const y = cy * CHUNK_SIZE + Math.floor(sim.rng.next() * CHUNK_SIZE);
    if (validEnemySpawn(sim, x, y)) return { x, y };
  }
  return null;
}

export function randomNearbySpot(
  sim: SimState,
  anchor: { x: number; y: number },
  radius: number,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = sim.rng.next() * Math.PI * 2;
    const distance = Math.sqrt(sim.rng.next()) * radius;
    const x = Math.floor(anchor.x + Math.cos(angle) * distance);
    const y = Math.floor(anchor.y + Math.sin(angle) * distance);
    if (validEnemySpawn(sim, x, y)) return { x, y };
  }
  return null;
}
