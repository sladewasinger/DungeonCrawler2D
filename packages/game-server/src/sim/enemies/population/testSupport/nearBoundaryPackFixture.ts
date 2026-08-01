/** Owns deterministic near-boundary roaming-pack fixtures for population tests. */
import { vi } from "vitest";
import type { SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { spawnEnemyPack } from "../../population.js";
import { enemySpawnCenter, validEnemySpawn } from "../../populationPlacement.js";
import {
  isNearSpawnPopulationPosition,
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

interface BoundarySearch {
  readonly sim: SimState;
  readonly anchor: TilePosition;
  readonly center: TilePosition;
  readonly radius: number;
}

interface ControlledPackInput {
  readonly sim: SimState;
  readonly fixture: BoundaryPackFixture;
  readonly second: TilePosition;
}

export function findBoundaryPackFixture(sim: SimState): BoundaryPackFixture {
  const center = nearSpawnPopulationCenter();
  const input = { sim, center, radius: NEAR_SPAWN_POPULATION_RADIUS_TILES };
  const anchor = findBoundaryAnchor(input);
  const candidates = findBoundaryCandidates({ ...input, anchor });
  if (!candidates) throw new Error("missing near-boundary pack fixture");
  return {
    anchor,
    ...candidates,
    chunkX: Math.floor(anchor.x / 32),
    chunkY: Math.floor(anchor.y / 32),
  };
}

export function spawnControlledBoundaryPack(input: ControlledPackInput): void {
  const values = boundaryRandomValues(input.fixture, input.second);
  const rng = vi.spyOn(input.sim.rng, "next");
  rng.mockImplementation(() => values.shift() ?? 0);
  spawnEnemyPack(input.sim, input.fixture.chunkX, input.fixture.chunkY);
  rng.mockRestore();
}

function findBoundaryAnchor(input: Omit<BoundarySearch, "anchor">): TilePosition {
  const { center, radius } = input;
  for (let y = Math.floor(center.y - radius); y <= center.y + radius; y += 1) {
    for (let x = Math.floor(center.x - radius); x <= center.x + radius; x += 1) {
      const anchor = { x, y };
      if (isBoundaryAnchor({ ...input, anchor })) return anchor;
    }
  }
  throw new Error("missing valid near-boundary anchor");
}

function isBoundaryAnchor(input: BoundarySearch): boolean {
  const position = enemySpawnCenter(input.anchor);
  const distance = Math.hypot(
    position.x - input.center.x,
    position.y - input.center.y,
  );
  return validEnemySpawn(input.sim, input.anchor.x, input.anchor.y) &&
    distance >= input.radius - 1 && distance <= input.radius;
}

function findBoundaryCandidates(
  input: BoundarySearch,
): Pick<BoundaryPackFixture, "inside" | "outside"> | null {
  const inside = findBoundaryCandidate(input, "inside");
  const outside = findBoundaryCandidate(input, "outside");
  return inside && outside ? { inside, outside } : null;
}

function findBoundaryCandidate(
  input: BoundarySearch,
  kind: "inside" | "outside",
): TilePosition | null {
  const spread = ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles;
  for (let y = input.anchor.y - spread; y <= input.anchor.y + spread; y += 1) {
    for (let x = input.anchor.x - spread; x <= input.anchor.x + spread; x += 1) {
      const candidate = { x, y };
      if (classifyBoundaryCandidate(input, candidate) === kind) return candidate;
    }
  }
  return null;
}

function classifyBoundaryCandidate(
  input: BoundarySearch,
  candidate: TilePosition,
): "inside" | "outside" | null {
  if (!isValidNearbyCandidate(input, candidate)) return null;
  return isNearSpawnPopulationPosition(input.sim, enemySpawnCenter(candidate))
    ? "inside"
    : "outside";
}

function isValidNearbyCandidate(input: BoundarySearch, candidate: TilePosition): boolean {
  if (candidate.x === input.anchor.x && candidate.y === input.anchor.y) return false;
  if (!validEnemySpawn(input.sim, candidate.x, candidate.y)) return false;
  const distance = Math.hypot(
    candidate.x - input.anchor.x + 0.5,
    candidate.y - input.anchor.y + 0.5,
  );
  return distance <= ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles;
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
