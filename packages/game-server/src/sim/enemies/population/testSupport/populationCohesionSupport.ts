/** Owns deterministic remote-pack fixtures and roster assertions for population tests. */
import { expect, vi } from "vitest";
import { biomeAtWorldTile } from "@dc2d/engine";
import type { SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { spawnEnemyPack } from "../../population.js";
import { validEnemySpawn } from "../../populationPlacement.js";
import {
  enemyRosterForBiome,
  RANDOM_ENEMY_ROSTER,
} from "../../populationRoster.js";

interface TilePosition {
  readonly x: number;
  readonly y: number;
}

interface ControlledPackInput {
  readonly anchor: TilePosition;
  readonly second: TilePosition;
}

interface NearbyTileSearch {
  readonly sim: SimState;
  readonly anchor: TilePosition;
  readonly candidate: TilePosition;
  readonly radius: number;
}

export function spawnRepeatedAnchorPack(sim: SimState): void {
  const anchor = findValidTile(sim, 8, 8);
  const chunkX = Math.floor(anchor.x / 32);
  const chunkY = Math.floor(anchor.y / 32);
  const values = [
    (anchor.x - chunkX * 32 + 0.1) / 32,
    (anchor.y - chunkY * 32 + 0.1) / 32,
  ];
  const rng = vi.spyOn(sim.rng, "next");
  rng.mockImplementation(() => values.shift() ?? 0);
  spawnEnemyPack(sim, chunkX, chunkY);
  rng.mockRestore();
}

export function spawnControlledOutlierPack(sim: SimState): void {
  const anchor = findNativeExcludingTile(sim, "plant-creeper");
  const second = findNearbyTile(sim, anchor);
  const input = { anchor, second };
  const values = controlledPackRandomValues(input);
  const rng = vi.spyOn(sim.rng, "next");
  rng.mockImplementation(() => values.shift() ?? 0);
  spawnEnemyPack(sim, Math.floor(anchor.x / 32), Math.floor(anchor.y / 32));
  rng.mockRestore();
}

export function expectPackMembers(sim: SimState): void {
  const enemies = [...sim.enemies.values()];
  const native = nativeRoster(sim, enemies[0]?.entity.body ?? { x: 0, y: 0 });
  const optional = enemies.slice(2);
  expectOptionalRoster(optional, native);
  expect(enemies.every((enemy) => Number.isFinite(enemy.entity.body.x) &&
    Number.isFinite(enemy.entity.body.y))).toBe(true);
}

function expectOptionalRoster(
  optional: readonly { def: { id: string } }[],
  native: readonly string[],
): void {
  expect(optional.every((enemy) =>
    [...native, ...RANDOM_ENEMY_ROSTER].includes(enemy.def.id),
  )).toBe(true);
  expect(optional.filter((enemy) => !native.includes(enemy.def.id)).length)
    .toBeLessThanOrEqual(1);
}

function findValidTile(sim: SimState, chunkX: number, chunkY: number): TilePosition {
  for (let y = chunkY * 32; y < chunkY * 32 + 32; y += 1) {
    for (let x = chunkX * 32; x < chunkX * 32 + 32; x += 1) {
      if (validEnemySpawn(sim, x, y)) return { x, y };
    }
  }
  throw new Error("missing valid population tile");
}

interface NativeTileSearch {
  readonly sim: SimState;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly excluded: string;
}

function findNativeExcludingTile(sim: SimState, excluded: string): TilePosition {
  for (let chunkY = 8; chunkY < 13; chunkY += 1) {
    for (let chunkX = 8; chunkX < 13; chunkX += 1) {
      const input = { sim, chunkX, chunkY, excluded };
      const tile = findNativeTileInChunk(input);
      if (tile) return tile;
    }
  }
  throw new Error("missing native population tile");
}

function findNativeTileInChunk(input: NativeTileSearch): TilePosition | null {
  for (let y = input.chunkY * 32; y < input.chunkY * 32 + 32; y += 1) {
    for (let x = input.chunkX * 32; x < input.chunkX * 32 + 32; x += 1) {
      if (validEnemySpawn(input.sim, x, y) &&
          !nativeRoster(input.sim, { x, y }).includes(input.excluded)) {
        return { x, y };
      }
    }
  }
  return null;
}

function findNearbyTile(sim: SimState, anchor: TilePosition): TilePosition {
  const radius = ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles;
  for (let y = anchor.y - radius; y <= anchor.y + radius; y += 1) {
    for (let x = anchor.x - radius; x <= anchor.x + radius; x += 1) {
      const candidate = { x, y };
      if (isNearbyValidTile({ sim, anchor, candidate, radius })) return candidate;
    }
  }
  throw new Error("missing nearby population tile");
}

function isNearbyValidTile(input: NearbyTileSearch): boolean {
  const { sim, anchor, candidate, radius } = input;
  return (candidate.x !== anchor.x || candidate.y !== anchor.y) &&
    validEnemySpawn(sim, candidate.x, candidate.y) &&
    Math.hypot(candidate.x - anchor.x + 0.5, candidate.y - anchor.y + 0.5) <= radius;
}

function controlledPackRandomValues(input: ControlledPackInput): number[] {
  const chunkX = Math.floor(input.anchor.x / 32);
  const chunkY = Math.floor(input.anchor.y / 32);
  const placement = placementRandomValues(input.anchor, input.second);
  return [
    (input.anchor.x - chunkX * 32 + 0.1) / 32,
    (input.anchor.y - chunkY * 32 + 0.1) / 32,
    0,
    0.9,
    0,
    ...placement, ...placement,
    ...placement,
    0.99,
    0.07,
  ];
}

function placementRandomValues(anchor: TilePosition, target: TilePosition): number[] {
  const dx = target.x - anchor.x + 0.5;
  const dy = target.y - anchor.y + 0.5;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;
  const radius = ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles;
  return [angle / (Math.PI * 2), Math.min(0.99, (Math.hypot(dx, dy) / radius) ** 2)];
}

function nativeRoster(sim: SimState, tile: TilePosition): readonly string[] {
  const biome = biomeAtWorldTile({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    wx: tile.x,
    wy: tile.y,
  }).biome;
  return enemyRosterForBiome(biome);
}
