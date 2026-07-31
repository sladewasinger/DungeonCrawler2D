import {
  BIOME,
  biomeAtWorldTile,
  type BiomeKind,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";

const ORC_WARRIOR = "orc-warrior";
const SKELETON = "skeleton";
const FALLEN_ANGEL = "fallen-angel";
const MASKED_ORC = "masked-orc";
const PITCHBLOOM = "pitchbloom";
export const RANDOM_ENEMY_ROSTER = [
  "slime", "plant-creeper", PITCHBLOOM, SKELETON, "spitter", "goblin",
  MASKED_ORC, ORC_WARRIOR, "orc-shaman", "tiny-zombie",
  "big-zombie", "chort", "wogol", "pumpkin-fiend",
  FALLEN_ANGEL,
] as const;

export function enemyRosterForBiome(biome: BiomeKind): readonly string[] {
  if (biome === BIOME.Maze) {
    return ["goblin", MASKED_ORC, ORC_WARRIOR, "orc-shaman"];
  }
  if (biome === BIOME.OpenHalls) {
    return [SKELETON, FALLEN_ANGEL, ORC_WARRIOR];
  }
  if (biome === BIOME.Ruins) {
    return [SKELETON, "tiny-zombie", "big-zombie", FALLEN_ANGEL];
  }
  if (biome === BIOME.Pillars) {
    return ["plant-creeper", "pumpkin-fiend", "wogol"];
  }
  if (biome === BIOME.Pools) {
    return ["slime", "spitter", PITCHBLOOM, "wogol"];
  }
  return ["chort", MASKED_ORC, ORC_WARRIOR];
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
  const biome = biomeAtPosition(sim, x, y);
  return randomEntry(sim, enemyRosterForBiome(biome));
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
  const biome = biomeAtPosition(selection.sim, selection.x, selection.y);
  return enemyRosterForBiome(biome).filter(selection.isAllowed);
}

function biomeAtPosition(sim: SimState, x: number, y: number): BiomeKind {
  return biomeAtWorldTile({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    wx: x,
    wy: y,
  }).biome;
}

function randomOptionalEntry(
  sim: SimState,
  entries: readonly string[],
): string | null {
  if (entries.length === 0) return null;
  return randomEntry(sim, entries);
}
