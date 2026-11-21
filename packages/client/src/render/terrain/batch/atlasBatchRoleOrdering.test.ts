import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { atlasDraws, terrainMeshBatches } from "./atlasBatch.js";

const projection = { project: ({ x, y, z }: { x: number; y: number; z: number }) => ({ x, y: y - z }) };
const image = { width: 576, height: 320 };
const quad = (surface: "floor" | "bedrock", x: number) => ({
  kind: "floor" as const, surface, worldTile: { x, y: 1 }, viewTile: { x, y: 1 }, height: surface === "bedrock" ? 2 : 0,
  vertices: [{ x, y: 1, z: 0 }, { x: x + 1, y: 1, z: 0 }, { x: x + 1, y: 2, z: 0 }, { x, y: 2, z: 0 }] as const,
});

describe("atlas material ordering", () => {
  it("keeps equal-depth roles deterministic after chunk reload", () => {
    const draws = atlasDraws({
      floors: [quad("bedrock", 2), quad("floor", 1)],
      voids: [], features: [], props: [], southFaces: [], cliffEdges: [], ao: [],
    }, { projection, biomeAt: () => BIOME.Maze, debug: false });

    expect(draws.map(({ role }) => role)).toEqual(["bedrock", "floor"]);
    expect(terrainMeshBatches(draws, () => image).map(({ role }) => role))
      .toEqual(["bedrock", "floor"]);
  });
});
