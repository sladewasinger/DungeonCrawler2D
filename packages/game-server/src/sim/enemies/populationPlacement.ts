import {
  CHASM_DEATH_Z,
  CHUNK_SIZE,
  miniBossArenaAtPosition,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";
import { enemyOccupancyIsAllowed } from "./roomIsolation/enemyRoomIsolation.js";
import { isInsideSpawnEnemyExclusion } from "./population/nearSpawn.js";

export interface SpawnBounds {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface RandomRadiusSpawn {
  readonly sim: SimState;
  readonly anchor: { x: number; y: number };
  readonly radius: number;
  readonly attempts: number;
}

export function tooCloseToPlayer(sim: SimState, x: number, y: number): boolean {
  const centerX = x + 0.5;
  const centerY = y + 0.5;
  for (const slot of sim.players.values()) {
    if (Math.hypot(
      slot.entity.body.x - centerX,
      slot.entity.body.y - centerY,
    ) <
        ENEMY_SIMULATION_TUNING.population.minimumPlayerDistanceTiles) {
      return true;
    }
  }
  return false;
}

export function validEnemySpawn(sim: SimState, x: number, y: number): boolean {
  if (!sim.world.isWalkable(x, y) ||
      !enemyOccupancyIsAllowed(sim, { x, y })) return false;
  if (sim.world.heightAt(x, y) <= CHASM_DEATH_Z) return false;
  if (miniBossArenaAtPosition(sim.world, x, y)) return false;
  if (isInsideSpawnEnemyExclusion(sim, { x: x + 0.5, y: y + 0.5 })) return false;
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

export function randomSpawnWithinRadius(
  input: RandomRadiusSpawn,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < input.attempts; attempt++) {
    const spot = randomRadiusTile(input.sim, input.anchor, input.radius);
    if (!tileCenterIsWithinRadius(spot, input)) continue;
    if (validEnemySpawn(input.sim, spot.x, spot.y)) return spot;
  }
  return null;
}

function tileCenterIsWithinRadius(
  spot: { x: number; y: number },
  input: RandomRadiusSpawn,
): boolean {
  return Math.hypot(
    spot.x + 0.5 - input.anchor.x,
    spot.y + 0.5 - input.anchor.y,
  ) <= input.radius;
}

function randomRadiusTile(
  sim: SimState,
  anchor: { x: number; y: number },
  radius: number,
): { x: number; y: number } {
  const angle = sim.rng.next() * Math.PI * 2;
  const distance = Math.sqrt(sim.rng.next()) * radius;
  return {
    x: Math.floor(anchor.x + Math.cos(angle) * distance),
    y: Math.floor(anchor.y + Math.sin(angle) * distance),
  };
}
