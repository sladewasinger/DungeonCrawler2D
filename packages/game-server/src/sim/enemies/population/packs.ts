import { spawnEnemy } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import { canAddNearSpawnEnemies, canAddNearSpawnEnemy, isNearSpawnPopulationPosition } from "./nearSpawn.js";
import {
  enemySpawnCenter,
  randomChunkSpot,
  randomNearbySpot,
} from "../populationPlacement.js";
import {
  pickAllowedEnemyDef,
  pickAllowedNativeEnemyDef,
  pickEnemyDef,
  pickNativeEnemyDef,
} from "../populationRoster.js";
import { CHORT_PITCHBLOOM_PAIR } from "./territoryFactionPolicies.js";

const ENEMY_CAP = 150; const REQUIRED_PACK_MEMBERS = CHORT_PITCHBLOOM_PAIR;

type PackSpot = { readonly x: number; readonly y: number };
type DraftedPackMember = { readonly defId: string; readonly spot: PackSpot };

export function spawnEnemyPack(sim: SimState, cx: number, cy: number): void {
  const anchor = randomChunkSpot(sim, cx, cy);
  if (!anchor) return;
  const nearSpawn = isNearSpawnTile(sim, anchor);
  const packDef = pickPackDef(sim, anchor, nearSpawn);
  const count = packSize(sim, nearSpawn);
  const outlierIndex = selectOutlierIndex(sim, count);
  const members = draftPack({
    sim,
    anchor,
    nearSpawn,
    count,
    packDef,
    outlierIndex,
  });
  if (!members) return;
  for (const member of members) {
    spawnEnemy(sim, {
      defId: member.defId,
      x: member.spot.x + 0.5,
      y: member.spot.y + 0.5,
    });
  }
}

function pickPackDef(
  sim: SimState,
  anchor: PackSpot,
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
  return Math.max(
    REQUIRED_PACK_MEMBERS.length,
    minimum + Math.floor(sim.rng.next() * (maximum - minimum + 1)),
  );
}

function selectOutlierIndex(sim: SimState, count: number): number {
  return count > REQUIRED_PACK_MEMBERS.length && sim.rng.next() < 0.35
    ? count - 1
    : -1;
}

interface PackDraftInput {
  readonly sim: SimState; readonly anchor: PackSpot;
  readonly nearSpawn: boolean; readonly count: number; readonly packDef: string | null;
  readonly outlierIndex: number;
}

function draftPack(input: PackDraftInput): DraftedPackMember[] | null {
  if (input.sim.enemies.size + REQUIRED_PACK_MEMBERS.length > ENEMY_CAP) return null;
  const required = draftRequiredMembers(input);
  if (!required || !nearSpawnBatchFits(input.sim, required)) return null;
  const optional = draftOptionalMembers(input);
  return fitOptionalMembers(input.sim, [...required, ...optional]);
}

function draftRequiredMembers(input: PackDraftInput): DraftedPackMember[] | null {
  const secondSpot = secondRequiredSpot(input);
  if (!secondSpot) return null;
  return [{ defId: REQUIRED_PACK_MEMBERS[0], spot: input.anchor }, { defId: REQUIRED_PACK_MEMBERS[1], spot: secondSpot }];
}

function secondRequiredSpot(input: PackDraftInput): PackSpot | null {
  for (let attempt = 0; attempt < 4; attempt++) {
    const spot = randomNearbySpot(input.sim, input.anchor, ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles);
    if (!spot || (spot.x === input.anchor.x && spot.y === input.anchor.y)) continue;
    if (input.nearSpawn && !isNearSpawnTile(input.sim, spot)) {
      continue;
    }
    return spot;
  }
  return null;
}

function draftOptionalMembers(input: PackDraftInput): DraftedPackMember[] {
  const optional: DraftedPackMember[] = [];
  for (let index = REQUIRED_PACK_MEMBERS.length; index < input.count; index++) {
    const spot = randomNearbySpot(input.sim, input.anchor,
      ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles);
    if (!spot || input.nearSpawn && !isNearSpawnTile(input.sim, spot)) {
      continue;
    }
    const defId = packMemberDef({ ...input, index }, spot);
    if (defId) optional.push({ defId, spot });
  }
  return optional;
}

function packMemberDef(input: PackDraftInput & { readonly index: number }, spot: PackSpot): string | null {
  const { sim, packDef, outlierIndex, index } = input;
  const memberNearSpawn = isNearSpawnTile(sim, spot);
  if (!memberNearSpawn) {
    return index === outlierIndex
      ? pickEnemyDef(sim, spot.x, spot.y)
      : packDef;
  }
  if (index !== outlierIndex && packDef && canAddNearSpawnEnemy(sim, packDef)) {
    return packDef;
  }
  return pickAllowedEnemyDef({
    sim,
    x: spot.x,
    y: spot.y,
    isAllowed: (defId) => canAddNearSpawnEnemy(sim, defId),
  });
}

function nearSpawnBatchFits(sim: SimState, members: readonly DraftedPackMember[]): boolean {
  const nearSpawnDefIds = members.filter((member) => isNearSpawnTile(sim, member.spot))
    .map((member) => member.defId);
  return canAddNearSpawnEnemies(sim, nearSpawnDefIds);
}

function isNearSpawnTile(sim: SimState, tile: PackSpot): boolean {
  return isNearSpawnPopulationPosition(sim, enemySpawnCenter(tile));
}

function fitOptionalMembers(sim: SimState, members: DraftedPackMember[]): DraftedPackMember[] {
  const fitted = members.slice(0, REQUIRED_PACK_MEMBERS.length);
  for (const member of members.slice(REQUIRED_PACK_MEMBERS.length)) {
    if (sim.enemies.size + fitted.length >= ENEMY_CAP) break;
    const candidate = [...fitted, member];
    if (nearSpawnBatchFits(sim, candidate)) fitted.push(member);
  }
  return fitted;
}
