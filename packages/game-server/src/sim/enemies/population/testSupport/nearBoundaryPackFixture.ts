/** Owns deterministic near-boundary roaming-pack fixtures for population tests. */
import { CHASM_DEATH_Z, TILE } from "@dc2d/engine";
import { vi } from "vitest";
import type { SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { spawnEnemyPack } from "../../population.js";
import {
  nearSpawnPopulationCenter,
  NEAR_SPAWN_POPULATION_RADIUS_TILES,
} from "../nearSpawn.js";

export interface BoundaryPackFixture {
  readonly anchor: TilePosition;
  readonly inside: TilePosition;
  readonly outside: TilePosition;
  readonly chunkX: number;
  readonly chunkY: number;
}

interface TilePosition {
  readonly x: number;
  readonly y: number;
}

interface ControlledPackInput {
  readonly sim: SimState;
  readonly fixture: BoundaryPackFixture;
  readonly second: TilePosition;
}

interface BoundaryTerrainSearch {
  readonly sim: SimState;
  readonly center: TilePosition;
  readonly radius: number;
}

interface BoundaryCandidates extends BoundaryTerrainSearch {
  readonly inside: TilePosition;
  readonly outside: TilePosition;
}

export function findBoundaryPackFixture(sim: SimState): BoundaryPackFixture {
  const center = nearSpawnPopulationCenter();
  const radius = NEAR_SPAWN_POPULATION_RADIUS_TILES;
  const { anchor, inside, outside } = findBoundaryTerrain({ sim, center, radius });
  sim.world.replaceTileOverrides([anchor, inside, outside].map(({ x, y }) => ({
    x, y, tile: TILE.Floor,
  })));
  return {
    anchor, inside, outside,
    chunkX: Math.floor(anchor.x / 32),
    chunkY: Math.floor(anchor.y / 32),
  };
}

function findBoundaryTerrain(
  input: BoundaryTerrainSearch,
): Pick<BoundaryPackFixture, "anchor" | "inside" | "outside"> {
  for (const anchor of boundarySearchTiles(input)) {
    if (!insideBoundaryBand(input, anchor)) continue;
    const fixture = boundaryFixtureAt(input, anchor);
    if (fixture) return fixture;
  }
  throw new Error("missing height-valid near-boundary terrain");
}

function boundarySearchTiles(input: BoundaryTerrainSearch): TilePosition[] {
  const minimumY = Math.floor(input.center.y - input.radius - 1);
  const maximumY = Math.ceil(input.center.y + input.radius + 1);
  const minimumX = Math.floor(input.center.x - input.radius - 1);
  const maximumX = Math.ceil(input.center.x + input.radius + 1);
  return Array.from({ length: maximumY - minimumY + 1 }, (_, row) =>
    Array.from({ length: maximumX - minimumX + 1 }, (_, column) => ({
      x: minimumX + column,
      y: minimumY + row,
    })),
  ).flat();
}

const CARDINAL_DIRECTIONS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
] as const;

function boundaryFixtureAt(
  input: BoundaryTerrainSearch,
  anchor: TilePosition,
): Pick<BoundaryPackFixture, "anchor" | "inside" | "outside"> | null {
  for (const direction of CARDINAL_DIRECTIONS) {
    const inside = { x: anchor.x + direction.x, y: anchor.y + direction.y };
    const outside = { x: anchor.x - direction.x, y: anchor.y - direction.y };
    if (boundaryCandidatesFit({ ...input, inside, outside })) {
      return { anchor, inside, outside };
    }
  }
  return null;
}

function insideBoundaryBand(
  input: BoundaryTerrainSearch,
  tile: TilePosition,
): boolean {
  const distance = tileDistance(input.center, tile);
  return input.sim.world.heightAt(tile.x, tile.y) > CHASM_DEATH_Z &&
    distance >= input.radius - 1 && distance <= input.radius;
}

function boundaryCandidatesFit(input: BoundaryCandidates): boolean {
  return input.sim.world.heightAt(input.inside.x, input.inside.y) > CHASM_DEATH_Z &&
    input.sim.world.heightAt(input.outside.x, input.outside.y) > CHASM_DEATH_Z &&
    tileDistance(input.center, input.inside) <= input.radius &&
    tileDistance(input.center, input.outside) > input.radius;
}

function tileDistance(center: TilePosition, tile: TilePosition): number {
  return Math.hypot(tile.x + 0.5 - center.x, tile.y + 0.5 - center.y);
}

export function spawnControlledBoundaryPack(input: ControlledPackInput): void {
  const values = boundaryRandomValues(input.fixture, input.second);
  const rng = vi.spyOn(input.sim.rng, "next");
  rng.mockImplementation(() => values.shift() ?? 0);
  spawnEnemyPack(input.sim, input.fixture.chunkX, input.fixture.chunkY);
  rng.mockRestore();
}

function boundaryRandomValues(
  fixture: BoundaryPackFixture,
  second: TilePosition,
): number[] {
  const placement = placementRandomValues(fixture.anchor, second);
  return [
    (fixture.anchor.x - fixture.chunkX * 32 + 0.1) / 32,
    (fixture.anchor.y - fixture.chunkY * 32 + 0.1) / 32,
    0,
    0,
    ...placement,
    ...placement,
    ...placement,
    ...placement,
  ];
}

function placementRandomValues(anchor: TilePosition, target: TilePosition): number[] {
  const dx = target.x - anchor.x + 0.5;
  const dy = target.y - anchor.y + 0.5;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;
  const radius = ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles;
  return [
    angle / (Math.PI * 2),
    Math.min(0.99, (Math.hypot(dx, dy) / radius) ** 2),
  ];
}
