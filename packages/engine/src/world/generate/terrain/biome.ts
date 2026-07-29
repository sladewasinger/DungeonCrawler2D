import { CHUNK_SIZE } from "../../core/types.js";
import { layoutSeed } from "../layout/hash.js";
import {
  biomeForDistrict,
  districtAt,
  type BiomeKind,
  type DistrictKind,
} from "../layout/district.js";

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
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cy = Math.floor(wy / CHUNK_SIZE);
  const district = districtAt(layoutSeed(worldSeed, floor), cx, cy);
  return { district, biome: biomeForDistrict(district) };
}
