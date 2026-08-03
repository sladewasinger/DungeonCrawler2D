import { BIOME, type BiomeKind } from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { factionRosterForOwnershipTags } from "./population/territoryFactionPolicies.js";

const GOBLIN = "goblin";
const SLIME = "slime";
const SPITTER = "spitter";
const PLANT_CREEPER = "plant-creeper";
const ORC_SHAMAN = "orc-shaman";
const CHORT = "chort";
const ORC_WARRIOR = "orc-warrior";
const SKELETON = "skeleton";
const FALLEN_ANGEL = "fallen-angel";
const MASKED_ORC = "masked-orc";
const PITCHBLOOM = "pitchbloom";

export const RANDOM_ENEMY_ROSTER = [
  SLIME, PLANT_CREEPER, PITCHBLOOM, SKELETON, SPITTER, GOBLIN,
  MASKED_ORC, ORC_WARRIOR, ORC_SHAMAN, "tiny-zombie",
  "big-zombie", CHORT, "wogol", "pumpkin-fiend",
  FALLEN_ANGEL,
] as const;

export function enemyRosterForBiome(biome: BiomeKind): readonly string[] {
  if (biome === BIOME.Maze) {
    return [GOBLIN, MASKED_ORC, ORC_WARRIOR, ORC_SHAMAN];
  }
  if (biome === BIOME.OpenHalls) {
    return [SKELETON, FALLEN_ANGEL, ORC_WARRIOR];
  }
  if (biome === BIOME.Ruins) {
    return [SKELETON, "tiny-zombie", "big-zombie", FALLEN_ANGEL];
  }
  if (biome === BIOME.Pillars) {
    return [PLANT_CREEPER, "pumpkin-fiend", "wogol"];
  }
  if (biome === BIOME.Pools) {
    return [SLIME, SPITTER, PITCHBLOOM, "wogol"];
  }
  return [CHORT, MASKED_ORC, ORC_WARRIOR];
}

function randomEntry(sim: SimState, entries: readonly string[]): string {
  return entries[Math.floor(sim.rng.next() * entries.length)] ?? entries[0]!;
}

interface AllowedEnemySelection {
  readonly sim: SimState;
  readonly x: number;
  readonly y: number;
  readonly isAllowed: (defId: string) => boolean;
}

export function pickEnemyDef(
  sim: SimState,
  x: number,
  y: number,
): string {
  if (sim.rng.next() >= 0.88) return randomEntry(sim, RANDOM_ENEMY_ROSTER);
  return pickNativeEnemyDef(sim, x, y);
}

export function pickNativeEnemyDef(
  sim: SimState,
  x: number,
  y: number,
): string {
  return randomEntry(sim, nativeRosterAtPosition(sim, x, y));
}

export function pickAllowedEnemyDef(
  selection: AllowedEnemySelection,
): string | null {
  const native = allowedNativeRoster(selection);
  const global = RANDOM_ENEMY_ROSTER.filter(selection.isAllowed);
  const useGlobal = selection.sim.rng.next() >= 0.88;
  return randomOptionalEntry(
    selection.sim,
    useGlobal ? global : native,
  ) ?? randomOptionalEntry(selection.sim, useGlobal ? native : global);
}

export function pickAllowedNativeEnemyDef(
  selection: AllowedEnemySelection,
): string | null {
  return randomOptionalEntry(selection.sim, allowedNativeRoster(selection));
}

function allowedNativeRoster(
  selection: AllowedEnemySelection,
): readonly string[] {
  return nativeRosterAtPosition(selection.sim, selection.x, selection.y)
    .filter(selection.isAllowed);
}

function biomeAtPosition(sim: SimState, x: number, y: number): BiomeKind {
  return sim.world.biomeAtWorldTile(x, y)?.biome ?? BIOME.Maze;
}

function nativeRosterAtPosition(sim: SimState, x: number, y: number): readonly string[] {
  const territory = territoryAtPosition(sim, x, y);
  if (territory) {
    return factionRosterForOwnershipTags(territory.ownershipTags);
  }
  return enemyRosterForBiome(biomeAtPosition(sim, x, y));
}

export function enemyRosterAtPosition(sim: SimState, x: number, y: number): readonly string[] {
  return nativeRosterAtPosition(sim, x, y);
}

function territoryAtPosition(sim: SimState, x: number, y: number) {
  const index = sim.world.territoryAtWorldTile(x, y);
  return index === null ? undefined : sim.world.generatedFloor?.territories[index];
}

function randomOptionalEntry(
  sim: SimState,
  entries: readonly string[],
): string | null {
  if (entries.length === 0) return null;
  return randomEntry(sim, entries);
}
