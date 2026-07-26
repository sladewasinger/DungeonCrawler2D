import {
  BIOME,
  biomeAtWorldTile,
  type BiomeKind,
} from "@dc2d/engine";
import type { SimState } from "../state.js";

const GLOBAL_ROSTER = [
  "slime", "plant-creeper", "skeleton", "spitter", "goblin",
  "masked-orc", "orc-warrior", "orc-shaman", "tiny-zombie",
  "big-zombie", "chort", "big-demon", "wogol", "pumpkin-fiend",
  "fallen-angel",
] as const;

export function enemyRosterForBiome(biome: BiomeKind): readonly string[] {
  if (biome === BIOME.Maze) {
    return ["goblin", "masked-orc", "orc-warrior", "orc-shaman"];
  }
  if (biome === BIOME.OpenHalls) {
    return ["skeleton", "fallen-angel", "orc-warrior"];
  }
  if (biome === BIOME.Ruins) {
    return ["skeleton", "tiny-zombie", "big-zombie", "fallen-angel"];
  }
  if (biome === BIOME.Pillars) {
    return ["plant-creeper", "pumpkin-fiend", "wogol"];
  }
  if (biome === BIOME.Pools) return ["slime", "spitter", "wogol"];
  return ["chort", "big-demon", "masked-orc", "orc-warrior"];
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
  const biome = biomeAtWorldTile(
    sim.world.worldSeed,
    sim.world.floor,
    x,
    y,
  ).biome;
  return randomEntry(sim, enemyRosterForBiome(biome));
}
