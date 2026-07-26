import { BIOME, type BiomeKind } from "@dc2d/engine";
import * as THREE from "three";

type Material = { dispose(): void };

export interface BiomeMaterials {
  readonly floors: Material[];
  readonly walls: Material[];
}

const COLORS: Readonly<Record<BiomeKind, {
  readonly floors: readonly [string, string, string, string];
  readonly walls: readonly [string, string, string, string];
}>> = {
  [BIOME.Maze]: {
    floors: ["#59606c", "#4b525e", "#3e4550", "#353c48"],
    walls: ["#3b385f", "#332f54", "#292646", "#211f38"],
  },
  [BIOME.OpenHalls]: {
    floors: ["#706958", "#615b4d", "#504b40", "#403c34"],
    walls: ["#574b3d", "#493f35", "#3b332b", "#2e2822"],
  },
  [BIOME.Ruins]: {
    floors: ["#665b63", "#584e56", "#494149", "#3c353c"],
    walls: ["#51404d", "#443641", "#382c35", "#2b222a"],
  },
  [BIOME.Pillars]: {
    floors: ["#536858", "#47594c", "#3b4b40", "#303d34"],
    walls: ["#384d3d", "#304134", "#28362c", "#202b23"],
  },
  [BIOME.Pools]: {
    floors: ["#416b75", "#385c66", "#2e4c55", "#263e46"],
    walls: ["#31545e", "#294750", "#233b43", "#1b2f35"],
  },
  [BIOME.Arena]: {
    floors: ["#735c52", "#634f47", "#52423b", "#433630"],
    walls: ["#5b3f39", "#4c3530", "#3f2c28", "#32231f"],
  },
};

export function createBiomeMaterials(): Record<BiomeKind, BiomeMaterials> {
  return Object.fromEntries(
    Object.entries(COLORS).map(([biome, palette]) => [
      biome,
      {
        floors: palette.floors.map((color) => new THREE.MeshLambertMaterial({ color })),
        walls: palette.walls.map((color) => new THREE.MeshLambertMaterial({ color })),
      },
    ]),
  ) as Record<BiomeKind, BiomeMaterials>;
}

export function disposeBiomeMaterials(materials: Record<BiomeKind, BiomeMaterials>): void {
  for (const palette of Object.values(materials)) {
    for (const material of [...palette.floors, ...palette.walls]) material.dispose();
  }
}
