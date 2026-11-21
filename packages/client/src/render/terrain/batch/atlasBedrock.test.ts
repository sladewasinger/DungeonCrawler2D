import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { atlasDraws } from "./atlasBatch.js";
import type { TerrainScreenProjection } from "./quadBatch.js";
import type { TerrainBatches } from "../planning/terrainPlanner.js";

const projection: TerrainScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};

describe("finite bedrock atlas classification", () => {
  it.each([BIOME.Maze, BIOME.Pools])("keeps upper wall caps as bedrock in the %s atlas path", (biome) => {
    const draw = atlasDraws({
      ...batches, voids: [], southFaces: [],
      floors: [{ ...batches.floors[0]!, surface: "bedrock", height: 2 }],
    }, { projection, biomeAt: () => biome, territoryAt: () => 2, debug: false })[0];
    expect(draw?.role).toBe("bedrock");
    expect(draw?.role).not.toMatch(/territory|floor/);
  });
});

const batches: TerrainBatches = {
  voids: [], features: [], props: [], cliffEdges: [], ao: [], southFaces: [],
  floors: [{
    kind: "floor", surface: "floor", worldTile: { x: 1, y: 1 }, viewTile: { x: 1, y: 1 }, height: 2,
    vertices: [{ x: 1, y: 1, z: 2 }, { x: 2, y: 1, z: 2 }, { x: 2, y: 2, z: 2 }, { x: 1, y: 2, z: 2 }],
  }],
};
