import { finiteFloorForRuntime, floorBiomeAt } from "../finiteFloor.js";
import { profileForBiome } from "../finiteFloorBiomeProfiles.js";
import type { BiomeKind, DistrictKind } from "../layout/district.js";

export interface WorldBiome {
  readonly district: DistrictKind;
  readonly biome: BiomeKind;
}

export function biomeAtWorldTile({ worldSeed, floor, wx, wy }: {
  worldSeed: number;
  floor: number;
  wx: number;
  wy: number;
}): WorldBiome {
  return floorBiomeAt(finiteFloorForRuntime({ worldSeed, floor }), wx, wy) ?? profileForBiome(0);
}
