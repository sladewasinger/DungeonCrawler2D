import { spawnEnemy } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import {
  canAddNearSpawnEnemy,
  isNearSpawnPopulationPosition,
} from "./nearSpawn.js";
import { randomChunkSpot, randomNearbySpot } from "../populationPlacement.js";
import {
  pickAllowedEnemyDef,
  pickAllowedNativeEnemyDef,
  pickEnemyDef,
  pickNativeEnemyDef,
} from "../populationRoster.js";

const ENEMY_CAP = 150;

export function spawnEnemyPack(sim: SimState, cx: number, cy: number): void {
  const anchor = randomChunkSpot(sim, cx, cy);
  if (!anchor) return;
  const nearSpawn = isNearSpawnPopulationPosition(sim, anchor);
  const packDef = pickPackDef(sim, anchor, nearSpawn);
  if (!packDef) return;
  const count = packSize(sim, nearSpawn);
  const outlierIndex = count > 2 && sim.rng.next() < 0.35 ? count - 1 : -1;
  for (let index = 0; index < count && sim.enemies.size < ENEMY_CAP; index++) {
    spawnPackMember({
      sim,
      index,
      anchor,
      packDef,
      outlierIndex,
      nearSpawn,
    });
  }
}

function pickPackDef(
  sim: SimState,
  anchor: { x: number; y: number },
  nearSpawn: boolean,
): string | null {
  if (!nearSpawn) return pickNativeEnemyDef(sim, anchor.x, anchor.y);
  return pickAllowedNativeEnemyDef({
    sim,
    x: anchor.x,
    y: anchor.y,
    isAllowed: (defId) => canAddNearSpawnEnemy(sim, defId),
  });
}

function packSize(sim: SimState, nearSpawn: boolean): number {
  const tuning = ENEMY_SIMULATION_TUNING.population;
  const minimum = nearSpawn
    ? tuning.nearSpawnPackMinimum
    : tuning.dungeonPackMinimum;
  const maximum = nearSpawn
    ? tuning.nearSpawnPackMaximum
    : tuning.dungeonPackMaximum;
  return minimum + Math.floor(sim.rng.next() * (maximum - minimum + 1));
}

interface PackMemberInput {
  readonly sim: SimState;
  readonly index: number;
  readonly anchor: { x: number; y: number };
  readonly packDef: string;
  readonly outlierIndex: number;
  readonly nearSpawn: boolean;
}

function spawnPackMember(input: PackMemberInput): void {
  const spot = packMemberSpot(input);
  if (!spot) return;
  if (input.nearSpawn &&
    !isNearSpawnPopulationPosition(input.sim, spot)) return;
  const defId = packMemberDef(input, spot);
  if (!defId) return;
  spawnEnemy(input.sim, {
    defId,
    x: spot.x + 0.5,
    y: spot.y + 0.5,
  });
}

function packMemberSpot(
  input: PackMemberInput,
): { x: number; y: number } | null {
  if (input.index === 0) return input.anchor;
  return randomNearbySpot(
    input.sim,
    input.anchor,
    ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles,
  );
}

function packMemberDef(
  input: PackMemberInput,
  spot: { x: number; y: number },
): string | null {
  const { sim, packDef, outlierIndex, index } = input;
  const memberNearSpawn = isNearSpawnPopulationPosition(sim, spot);
  if (!memberNearSpawn) {
    return index === outlierIndex ? pickEnemyDef(sim, spot.x, spot.y) : packDef;
  }
  if (index !== outlierIndex && canAddNearSpawnEnemy(sim, packDef)) {
    return packDef;
  }
  return pickAllowedEnemyDef({
    sim,
    x: spot.x,
    y: spot.y,
    isAllowed: (defId) => canAddNearSpawnEnemy(sim, defId),
  });
}
