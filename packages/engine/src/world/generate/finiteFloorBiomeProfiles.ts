import { BIOME, DISTRICT } from "./layout/district.js";
import type { BiomeLookup } from "./finiteFloorTypes.js";

export function profileForBiome(id: number): BiomeLookup {
  if (id === 1) return { district: DISTRICT.Flooded, biome: BIOME.Pools };
  if (id === 2) return { district: DISTRICT.Ruins, biome: BIOME.Ruins };
  if (id === 3) return { district: DISTRICT.Plaza, biome: BIOME.OpenHalls };
  if (id === 4) return { district: DISTRICT.Ruins, biome: BIOME.Pillars };
  if (id === 5) return { district: DISTRICT.Arena, biome: BIOME.Arena };
  return { district: DISTRICT.Warren, biome: BIOME.Maze };
}
