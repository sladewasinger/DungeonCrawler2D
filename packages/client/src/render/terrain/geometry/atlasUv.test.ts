import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainAtlasDraw, TerrainMeshBatch } from "../batch/atlasBatch.js";
import {
  TERRAIN_TILESETS,
  terrainAtlasFrameName,
  type TerrainTileRole,
} from "../planning/tileset.js";
import { appendMeshQuad, atlasUvBounds } from "./atlasGeometry.js";

const ATLAS_IMAGE = { width: 576, height: 320 };
const ROLE_V_BOUNDS = [
  { role: "floor", top: 0.9984375, bottom: 0.8015625 },
  { role: "south-face", top: 0.7984375, bottom: 0.6015625 },
  { role: "stairs", top: 0.5984375, bottom: 0.4015625 },
  { role: "door", top: 0.3984375, bottom: 0.2015625 },
  { role: "void", top: 0.1984375, bottom: 0.0015625 },
] as const;

describe("atlas Mesh2D UV coordinates", () => {
  it.each(ROLE_V_BOUNDS)(
    "maps the $role physical row through Phaser's global V convention",
    ({ role, top, bottom }) => {
      const batch = emptyBatch();

      appendMeshQuad(batch, atlasDraw(role), ATLAS_IMAGE);

      expect(batch.vertices[3]).toBeCloseTo(top);
      expect(batch.vertices[11]).toBeCloseTo(bottom);
    },
  );

  it("maps a normal-atlas bedrock cap to its distinct frame column and UVs", () => {
    const draw = atlasDraw("bedrock", TERRAIN_TILESETS[BIOME.Maze]);
    const uv = atlasUvBounds(draw, ATLAS_IMAGE);

    expect(draw.frame).toBe("terrain:shared-atlas:0:bedrock");
    expect(uv).toEqual({
      u0: (192.5 / 576), u1: (255.5 / 576),
      v0: 0.9984375, v1: 0.8015625,
    });
  });

  it("keeps the shared bedrock frame's dark source edge out of Mesh2D sampling", () => {
    const draw = atlasDraw("bedrock", TERRAIN_TILESETS[BIOME.Maze]);
    const uv = atlasUvBounds(draw, ATLAS_IMAGE);

    expect(uv.u0 * ATLAS_IMAGE.width).toBe(192.5);
    expect(uv.u1 * ATLAS_IMAGE.width).toBe(255.5);
  });
});

function emptyBatch(): TerrainMeshBatch {
  return {
    atlas: TERRAIN_TILESETS.debug,
    role: "floor",
    phase: 1,
    depth: 0,
    vertices: [],
    indices: [],
  };
}

function atlasDraw(role: TerrainTileRole, atlas = TERRAIN_TILESETS.debug): TerrainAtlasDraw {
  return {
    atlas,
    frame: terrainAtlasFrameName(atlas, role),
    role,
    variant: 0,
    phase: 1,
    depth: 0,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  };
}
