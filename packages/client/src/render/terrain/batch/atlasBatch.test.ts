import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { atlasDraws, terrainMeshBatches } from "./atlasBatch.js";
import type { TerrainScreenProjection } from "./quadBatch.js";
import type { TerrainBatches } from "../planning/terrainPlanner.js";
const projection: TerrainScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};
const atlasImage = { width: 576, height: 320 };
const FLOOR_FRAME = "terrain:shared-atlas:0:floor";
describe("atlasDraws", () => {
  it("uses the stable floor, void, and south-face roles for terrain caps and faces", () => {
    const draws = atlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });
    expect(draws.map(({ frame, phase }) => ({ frame, phase }))).toEqual([
      { frame: "terrain:shared-atlas:0:void", phase: 0 },
      { frame: FLOOR_FRAME, phase: 1 },
      { frame: FLOOR_FRAME, phase: 1 },
      { frame: "terrain:shared-atlas:0:south-face", phase: 2 },
      { frame: "terrain:shared-atlas:0:south-face", phase: 2 },
    ]);
    expect(draws[3]?.points).toEqual([{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 15 }, { x: 0, y: 15 }]);
    expect(draws[4]?.points).toEqual([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
  });
  it("keeps raised top-down surfaces on the floor cap material", () => {
    const draw = atlasDraws({ ...batches, voids: [], southFaces: [], floors: [batches.floors[1]!] }, {
      projection, biomeAt: () => BIOME.Maze, debug: false,
    })[0];
    expect(draw?.role).toBe("floor");
    expect(draw?.frame).toBe(FLOOR_FRAME);
  });
  it("uses a non-floor atlas role for bedrock caps before territory selection", () => {
    const draw = atlasDraws({ ...batches, voids: [], southFaces: [], floors: [{ ...batches.floors[0]!, surface: "bedrock" }] }, {
      projection, biomeAt: () => BIOME.Maze, territoryAt: () => 1, debug: false,
    })[0];
    expect(draw?.role).toBe("bedrock");
    expect(draw?.frame).toBe("terrain:shared-atlas:0:bedrock");
  });
  it("selects visible shared-atlas floor roles from finite territories", () => {
    const draws = atlasDraws(batches, {
      projection,
      biomeAt: () => BIOME.Maze,
      territoryAt: ({ x }) => x,
      debug: false,
    }).filter(({ phase, role }) => phase === 1 && role !== "void");

    expect(draws.slice(0, 2).map(({ role, frame }) => ({ role, frame }))).toEqual([
      { role: "territory-goblin-floor", frame: "terrain:shared-atlas:0:territory-goblin-floor" },
      { role: "territory-spider-floor", frame: "terrain:shared-atlas:0:territory-spider-floor" },
    ]);
  });
  it("groups by biome material and switches every draw to the debug atlas on request", () => {
    const biomeDraws = atlasDraws(batches, {
      projection,
      biomeAt: ({ x }) => x === 1 ? BIOME.Pillars : BIOME.Maze,
      debug: false,
    });
    const debugDraws = atlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: true });
    expect(new Set(biomeDraws.map((draw) => draw.atlas.key))).toEqual(new Set(["shared-atlas"]));
    expect(debugDraws.every((draw) => draw.atlas.key === "debug-atlas")).toBe(true);
  });
  it("uses the distinct stair wall role for a stair south face", () => {
    const draws = atlasDraws({
      ...batches,
      voids: [], floors: [],
      southFaces: [{ ...batches.southFaces[0]!, stairWall: true }],
    }, { projection, biomeAt: () => BIOME.Maze, debug: true });
    expect(draws.map(({ role, frame }) => ({ role, frame }))).toEqual([
      { role: "stair-wall-face", frame: "terrain:debug-atlas:0:stair-wall-face" },
      { role: "stair-wall-face", frame: "terrain:debug-atlas:0:stair-wall-face" },
    ]);
  });
  it("packs each texture/phase as UV quads for one Mesh2D submission", () => {
    const draws = atlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });
    const meshes = terrainMeshBatches(draws, () => atlasImage);
    expect(meshes).toHaveLength(3);
    expect(meshes.map((mesh) => [mesh.depth, mesh.phase, mesh.vertices.length, mesh.indices.length])).toEqual([
      [-100.5, 0, 16, 8], [99.5, 1, 32, 16], [100.5, 2, 32, 16],
    ]);
    expect(meshes[0]?.vertices.slice(0, 16)).toEqual([
      0, 0, 0.11197916666666667, 0.19843750000000004, 10, 0, 0.22135416666666666, 0.19843750000000004,
      10, 10, 0.22135416666666666, 0.0015625000000000222, 0, 10, 0.11197916666666667, 0.0015625000000000222,
    ]);
  });
  it("keeps equal-depth painter phases in separate submissions", () => {
    const draws = atlasDraws(batches, { projection, biomeAt: () => BIOME.Maze, debug: false });
    const mixedPhaseDraws = draws.map((draw) => ({ ...draw, depth: 10 }));
    const meshes = terrainMeshBatches(mixedPhaseDraws, () => atlasImage);

    expect(meshes).toHaveLength(3);
    expect(meshes.map((mesh) => mesh.phase)).toEqual([0, 1, 2]);
    expect(meshes.reduce((count, mesh) => count + mesh.vertices.length, 0))
      .toBe(mixedPhaseDraws.length * 16);
  });
  it("keeps cliff geometry out of atlas texture draws", () => {
    const draws = atlasDraws({
      ...batches,
      cliffEdges: [{
        kind: "cliff-edge", cliff: "middle", rotation: 90, height: 0,
        worldTile: { x: 2, y: 2 }, viewTile: { x: 2, y: 2 }, sides: ["west"],
        vertices: [{ x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 3, y: 3, z: 0 }, { x: 2, y: 3, z: 0 }],
      }],
    }, { projection, biomeAt: () => BIOME.Maze, debug: false });
    expect(draws).toHaveLength(atlasDraws(batches, {
      projection,
      biomeAt: () => BIOME.Maze,
      debug: false,
    }).length);
    expect(draws.every((draw) => draw.atlas.key === "shared-atlas")).toBe(true);
  });
  it("tiles multi-height faces and crops only a partial top tile", () => {
    const face = batches.southFaces[0]!;
    const draws = atlasDraws({
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

    const partialMesh = terrainMeshBatches(draws, () => atlasImage)[0]!;
    expect(partialMesh.vertices.slice(34, 36)).toEqual([0.11197916666666667, 0.7984375]);
    expect(partialMesh.vertices.slice(46, 48)).toEqual([0.11197916666666667, 0.7015625]);
  });
});

const batches: TerrainBatches = {
  voids: [{
    kind: "void", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 },
    vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }],
  }],
  features: [],
  props: [],
  cliffEdges: [],
  ao: [],
  floors: [{
    kind: "floor", surface: "floor", worldTile: { x: 0, y: 1 }, viewTile: { x: 0, y: 1 }, height: 0,
    vertices: [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }],
  }, {
    kind: "floor", surface: "floor", worldTile: { x: 1, y: 1 }, viewTile: { x: 1, y: 1 }, height: 2,
    vertices: [{ x: 1, y: 1, z: 2 }, { x: 2, y: 1, z: 2 }, { x: 2, y: 2, z: 2 }, { x: 1, y: 2, z: 2 }],
  }],
  southFaces: [{
    kind: "south-face", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 }, topHeight: 1, bottomHeight: -1,
    vertices: [{ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: -1 }, { x: 0, y: 1, z: -1 }],
  }],
};
