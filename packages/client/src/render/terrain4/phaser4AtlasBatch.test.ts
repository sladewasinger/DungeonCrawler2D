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
      { frame: "terrain4:terrain4-biomes:1:south-face", phase: 2 },
    ]);
    expect(draws[3]?.points).toEqual([{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 15 }, { x: 0, y: 15 }]);
    expect(draws[4]?.points).toEqual([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
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
      [-0.5, 0, 16, 8], [99.5, 1, 32, 16], [100.5, 2, 32, 16],
    ]);
    expect(meshes[0]?.vertices.slice(0, 16)).toEqual([
      0, 0, 0.5, 2 / 11, 10, 0, 0.625, 2 / 11,
      10, 10, 0.625, 1 / 11, 0, 10, 0.5, 1 / 11,
    ]);
  });

  it("rotates cliff UVs without changing the floor quad geometry", () => {
    const draws = terrain4AtlasDraws({
      ...batches,
      cliffEdges: [{
        kind: "cliff-edge", cliff: "middle", rotation: 90, height: 0,
        worldTile: { x: 2, y: 2 }, viewTile: { x: 2, y: 2 }, sides: ["west"],
        vertices: [{ x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 3, y: 3, z: 0 }, { x: 2, y: 3, z: 0 }],
      }],
    }, { projection, biomeAt: () => BIOME.Maze, debug: false });
    const cliff = draws.find((draw) => draw.role === "cliff-middle");
    expect(cliff?.rotation).toBe(90);
    const mesh = terrain4MeshBatches(draws, (atlas) => "columns" in atlas ? { width: 1060, height: 1484 } : { width: 800, height: 880 })
      .find((candidate) => candidate.atlas.key === "terrain4-cliffs");
    expect(mesh ? [mesh.vertices[2], mesh.vertices[3], mesh.vertices[6], mesh.vertices[7], mesh.vertices[10], mesh.vertices[11], mesh.vertices[14], mesh.vertices[15]] : undefined)
      .toEqual([0, 2 / 14, 0, 3 / 14, 1 / 2, 3 / 14, 1 / 2, 2 / 14]);
  });

  it("tiles multi-height faces and crops only a partial top tile", () => {
    const face = batches.southFaces[0]!;
    const draws = terrain4AtlasDraws({
      ...batches,
      voids: [], floors: [],
      southFaces: [{ ...face, topHeight: 2.5, bottomHeight: 0.0, vertices: [
        { x: 0, y: 1, z: 2.5 }, { x: 1, y: 1, z: 2.5 },
        { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 },
      ] }],
    }, { projection, biomeAt: () => BIOME.Maze, debug: false }).filter((draw) => draw.role === "south-face");

    expect(draws).toHaveLength(3);
    expect(draws[0]?.uvCrop).toBeUndefined();
    expect(draws[1]?.uvCrop).toBeUndefined();
    expect(draws[2]?.uvCrop).toEqual({ top: 0, bottom: 0.5 });
    expect(draws.map((draw) => draw.points[0]?.y)).toEqual([5, 0, -2.5]);
  });
});

const batches: Terrain4Batches = {
  voids: [{
    kind: "void", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 },
    vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }],
  }],
  features: [],
  props: [],
  cliffEdges: [],
  ao: [],
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
