import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrain4AtlasDraws } from "../batch/phaser4AtlasBatch.js";
import type { Terrain4ScreenProjection } from "../batch/phaser4QuadBatch.js";
import type { Terrain4Batches } from "../planning/terrainPlanner.js";

const SOUTH_FACE = "south-face";
const projection: Terrain4ScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};

describe("wall face draws", () => {
  it("top-aligns tiled wall segments above a fractional stair step", () => {
    const draws = terrain4AtlasDraws(stairNeighborBatches(), {
      projection,
      biomeAt: () => BIOME.Maze,
      debug: true,
    });

    expect(draws).toHaveLength(2);
    expect(draws.map((draw) => draw.role)).toEqual([SOUTH_FACE, SOUTH_FACE]);
    expect(draws.map((draw) => draw.points)).toEqual([
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }],
      [{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 8.125 }, { x: 0, y: 8.125 }],
    ]);
    expect(draws[0]?.uvCrop).toBeUndefined();
    expect(draws[1]?.uvCrop).toEqual({ top: 0, bottom: 0.625 });
  });
});

function stairNeighborBatches(): Terrain4Batches {
  return {
    voids: [], floors: [], features: [], props: [], cliffEdges: [], ao: [],
    southFaces: [{
      kind: SOUTH_FACE,
      worldTile: { x: 0, y: 0 },
      viewTile: { x: 0, y: 0 },
      topHeight: 2,
      bottomHeight: 0.375,
      stairWall: false,
      southNeighborIsStair: true,
      vertices: [
        { x: 0, y: 1, z: 2 }, { x: 1, y: 1, z: 2 },
        { x: 1, y: 1, z: 0.375 }, { x: 0, y: 1, z: 0.375 },
      ],
    }],
  };
}
