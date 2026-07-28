import { BIOME } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { Phaser4TerrainAtlasBatchRenderer, terrain4AtlasDraws, terrain4MeshBatches } from "./phaser4AtlasBatch.js";
import type { Terrain4ScreenProjection } from "./phaser4QuadBatch.js";
import type { Terrain4Batches } from "../planning/terrainPlanner.js";

const projection: Terrain4ScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};

describe("terrain4AtlasDraws", () => {
  it("uses the stable floor, raised-floor, void, and south-face roles", () => {
    const draws = terrain4AtlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });

    expect(draws.map(({ frame, phase }) => ({ frame, phase }))).toEqual([
      { frame: "terrain4:terrain4-uniform:0:void", phase: 0 },
      { frame: "terrain4:terrain4-uniform:0:floor", phase: 1 },
      { frame: "terrain4:terrain4-uniform:0:raised-floor", phase: 1 },
      { frame: "terrain4:terrain4-uniform:0:south-face", phase: 2 },
      { frame: "terrain4:terrain4-uniform:0:south-face", phase: 2 },
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

    expect(new Set(biomeDraws.map((draw) => draw.atlas.key))).toEqual(new Set(["terrain4-uniform"]));
    expect(debugDraws.every((draw) => draw.atlas.key === "terrain4-debug")).toBe(true);
  });

  it("packs each texture/phase as UV quads for one Mesh2D submission", () => {
    const draws = terrain4AtlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });
    const meshes = terrain4MeshBatches(draws, () => ({ width: 512, height: 64 }));

    expect(meshes).toHaveLength(3);
    expect(meshes.map((mesh) => [mesh.depth, mesh.phase, mesh.vertices.length, mesh.indices.length])).toEqual([
      [-0.5, 0, 16, 8], [99.5, 1, 32, 16], [100.5, 2, 32, 16],
    ]);
    expect(meshes[0]?.vertices.slice(0, 16)).toEqual([
      0, 0, 0.5, 1, 10, 0, 0.625, 1,
      10, 10, 0.625, 0, 0, 10, 0.5, 0,
    ]);
  });

  it("keeps cliff geometry out of atlas texture draws", () => {
    const draws = terrain4AtlasDraws({
      ...batches,
      cliffEdges: [{
        kind: "cliff-edge", cliff: "middle", rotation: 90, height: 0,
        worldTile: { x: 2, y: 2 }, viewTile: { x: 2, y: 2 }, sides: ["west"],
        vertices: [{ x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 3, y: 3, z: 0 }, { x: 2, y: 3, z: 0 }],
      }],
    }, { projection, biomeAt: () => BIOME.Maze, debug: false });

    expect(draws).toHaveLength(terrain4AtlasDraws(batches, {
      projection,
      biomeAt: () => BIOME.Maze,
      debug: false,
    }).length);
    expect(draws.every((draw) => draw.atlas.key === "terrain4-uniform")).toBe(true);
  });

  it("hides and restores procedural overlays with an orientation root", () => {
    const activeMesh = { setVisible: vi.fn() };
    const inactiveMesh = { setVisible: vi.fn() };
    const aoOverlay = { setVisible: vi.fn() };
    const cliffHighlight = { setVisible: vi.fn() };
    const batch = {
      visible: true,
      meshes: new Map([["active", activeMesh], ["inactive", inactiveMesh]]),
      active: new Set(["active"]),
      aoOverlay,
      cliffHighlight,
    };

    Phaser4TerrainAtlasBatchRenderer.prototype.setVisible.call(batch, false);
    Phaser4TerrainAtlasBatchRenderer.prototype.setVisible.call(batch, true);

    expect(activeMesh.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(activeMesh.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(inactiveMesh.setVisible).toHaveBeenCalledWith(false);
    expect(aoOverlay.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(aoOverlay.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(cliffHighlight.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(cliffHighlight.setVisible).toHaveBeenNthCalledWith(2, true);
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

    const partialMesh = terrain4MeshBatches(draws, () => ({ width: 512, height: 64 }))[0]!;
    expect(partialMesh.vertices.slice(34, 36)).toEqual([0.25, 1]);
    expect(partialMesh.vertices.slice(46, 48)).toEqual([0.25, 0.5]);
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
