import { describe, expect, it } from "vitest";
import type { Terrain4AtlasDraw, Terrain4MeshBatch } from "../batch/phaser4AtlasBatch.js";
import {
  TERRAIN4_TILESETS,
  terrain4AtlasFrameName,
  type Terrain4TileRole,
} from "../planning/terrain4Tileset.js";
import { appendMeshQuad } from "./terrain4AtlasGeometry.js";

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
});

function emptyBatch(): Terrain4MeshBatch {
  return {
    atlas: TERRAIN4_TILESETS.debug,
    phase: 1,
    depth: 0,
    vertices: [],
    indices: [],
  };
}

function atlasDraw(role: Terrain4TileRole): Terrain4AtlasDraw {
  const atlas = TERRAIN4_TILESETS.debug;
  return {
    atlas,
    frame: terrain4AtlasFrameName(atlas, role),
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
