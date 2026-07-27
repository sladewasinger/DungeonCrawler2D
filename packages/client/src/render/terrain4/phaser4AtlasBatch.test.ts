import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrain4AtlasDraws, terrain4MeshBatches } from "./phaser4AtlasBatch.js";
import type { Terrain4ScreenProjection } from "./phaser4QuadBatch.js";
import type { Terrain4Batches } from "./terrainPlanner.js";

const projection: Terrain4ScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};

describe("terrain4AtlasDraws", () => {
  it("uses the stable floor, raised-floor, void, and south-face roles", () => {
    const draws = terrain4AtlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });

    expect(draws.map(({ frame, phase }) => ({ frame, phase }))).toEqual([
      { frame: "terrain4:terrain4-biomes:1:void", phase: 0 },
      { frame: "terrain4:terrain4-biomes:2:floor", phase: 1 },
      { frame: "terrain4:terrain4-biomes:1:raised-floor", phase: 1 },
      { frame: "terrain4:terrain4-biomes:1:south-face", phase: 2 },
    ]);
    expect(draws[3]?.points).toEqual([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 15 }, { x: 0, y: 15 }]);
  });

  it("groups by biome material and switches every draw to the debug atlas on request", () => {
    const biomeDraws = terrain4AtlasDraws(batches, {
      projection,
      biomeAt: ({ x }) => x === 1 ? BIOME.Pillars : BIOME.Maze,
      debug: false,
    });
    const debugDraws = terrain4AtlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: true });

    expect(new Set(biomeDraws.map((draw) => draw.atlas.key))).toEqual(new Set(["terrain4-biomes", "terrain4-pillars"]));
    expect(debugDraws.every((draw) => draw.atlas.key === "terrain4-debug")).toBe(true);
  });

  it("packs each texture/phase as UV quads for one Mesh2D submission", () => {
    const draws = terrain4AtlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });
    const meshes = terrain4MeshBatches(draws, () => ({ width: 800, height: 880 }));

    expect(meshes).toHaveLength(3);
    expect(meshes.map((mesh) => [mesh.depth, mesh.phase, mesh.vertices.length, mesh.indices.length])).toEqual([
      [-0.5, 0, 16, 8], [99.5, 1, 32, 16], [100.5, 2, 16, 8],
    ]);
    expect(meshes[0]?.vertices.slice(0, 16)).toEqual([
      0, 0, 0.5, 1 / 11, 10, 0, 0.625, 1 / 11,
      10, 10, 0.625, 2 / 11, 0, 10, 0.5, 2 / 11,
    ]);
  });
});

const batches: Terrain4Batches = {
  voids: [{
    kind: "void", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 },
    vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }],
  }],
  features: [],
  props: [],
  floors: [{
    kind: "floor", worldTile: { x: 0, y: 1 }, viewTile: { x: 0, y: 1 }, height: 0,
    vertices: [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }],
  }, {
    kind: "floor", worldTile: { x: 1, y: 1 }, viewTile: { x: 1, y: 1 }, height: 2,
    vertices: [{ x: 1, y: 1, z: 2 }, { x: 2, y: 1, z: 2 }, { x: 2, y: 2, z: 2 }, { x: 1, y: 2, z: 2 }],
  }],
  southFaces: [{
    kind: "south-face", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 }, topHeight: 1, bottomHeight: -1,
    vertices: [{ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: -1 }, { x: 0, y: 1, z: -1 }],
  }],
};
