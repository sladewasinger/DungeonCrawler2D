import {
  BIOME,
  biomeAtWorldTile,
  type BiomeKind,
} from "@dc2d/engine";
import type { SimState } from "../state.js";

const ORC_WARRIOR = "orc-warrior";
const SKELETON = "skeleton";
const FALLEN_ANGEL = "fallen-angel";
const MASKED_ORC = "masked-orc";
const GLOBAL_ROSTER = [
  "slime", "plant-creeper", SKELETON, "spitter", "goblin",
  MASKED_ORC, ORC_WARRIOR, "orc-shaman", "tiny-zombie",
  "big-zombie", "chort", "big-demon", "wogol", "pumpkin-fiend",
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
  if (biome === BIOME.Pools) return ["slime", "spitter", "wogol"];
  return ["chort", "big-demon", MASKED_ORC, ORC_WARRIOR];
}

function randomEntry(sim: SimState, entries: readonly string[]): string {
  return entries[Math.floor(sim.rng.next() * entries.length)] ?? entries[0]!;
}

export function pickEnemyDef(
  sim: SimState,
  x: number,
  y: number,
): string {
  if (sim.rng.next() >= 0.88) return randomEntry(sim, GLOBAL_ROSTER);
  return pickNativeEnemyDef(sim, x, y);
}

export function pickNativeEnemyDef(
  sim: SimState,
  x: number,
  y: number,
): string {
  const biome = biomeAtWorldTile({ worldSeed: sim.world.worldSeed, floor: sim.world.floor, wx: x, wy: y }).biome;
  return randomEntry(sim, enemyRosterForBiome(biome));
}
