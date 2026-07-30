import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainBatches } from "../geometry/terrainPlannerModel.js";
import { groupSurfaceTintParts, type SurfaceTintOptions } from "./surfaceTint.js";

const projection: SurfaceTintOptions["projection"] = {
  project: ({ x, y, z }) => ({ x, y: y - z }),
};

describe("surface tint feature selection", () => {
  it("keeps bedrock tint when biome washes are disabled", () => {
    const groups = groupSurfaceTintParts(batches(), {
      projection,
      biomeAt: () => BIOME.Pools,
      biomeEnabled: false,
      bedrockEnabled: true,
    });
    const parts = [...groups.values()].flat();

    expect(parts).toHaveLength(1);
    expect(parts[0]?.bedrock).toBe(true);
    expect(parts[0]?.biome).toBeNull();
  });

  it("omits all tint layers when both features are disabled", () => {
    const groups = groupSurfaceTintParts(batches(), {
      projection,
      biomeAt: () => BIOME.Pools,
      biomeEnabled: false,
      bedrockEnabled: false,
    });

    expect(groups.size).toBe(0);
  });
});

function batches(): TerrainBatches {
  const vertices = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 2 },
    { x: 0, y: 1, z: 2 },
  ] as const;
  const base = { worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 }, vertices };
  return {
    voids: [],
    floors: [
      { ...base, kind: "floor", surface: "bedrock", height: 2 },
      { ...base, kind: "floor", surface: "floor", height: 0 },
    ],
    features: [],
    props: [],
    southFaces: [],
    cliffEdges: [],
    ao: [],
  };
}
