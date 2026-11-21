import { describe, expect, it } from "vitest";
import { BIOME, TILE, type AdminMap, type AdminMapCell } from "@dc2d/engine";
import { planLiveSpectatorTerrain } from "../liveSpectatorTerrain.js";
import { createSpectatorTerrainSource } from "./liveSpectatorTerrainSource.js";
import {
  terrainFloorRole,
  terrainWallRole,
  terrainWallSegments,
} from "../../../render/terrain/material/terrainMaterialRoles.js";
import { TERRAIN_TILESETS } from "../../../render/terrain/planning/tileset.js";

const SPIDER_WALL_ROLE = "territory-spider-wall";

describe("admin spectator normal terrain", () => {
  it("reuses gameplay surface classification for bedrock, floor, void, and cliff output", () => {
    const plan = planLiveSpectatorTerrain(map([
      cell({ x: 0, y: 0, height: 2, walkable: true, terrain: "floor" }),
      cell({ x: 1, y: 0, height: 2, walkable: false, terrain: "floor" }),
      cell({ x: 0, y: 1, height: 0, walkable: false, terrain: "void" }),
      cell({ x: 1, y: 1, height: 0, walkable: true, terrain: "floor" }),
    ]));

    expect(plan.batches.floors).toEqual(expect.arrayContaining([
      expect.objectContaining({ worldTile: { x: 0, y: 0 }, surface: "floor" }),
      expect.objectContaining({ worldTile: { x: 1, y: 0 }, surface: "bedrock" }),
    ]));
    expect(plan.batches.voids.length).toBeGreaterThan(0);
    expect(plan.batches.cliffEdges.length).toBeGreaterThan(0);
  });

  it("uses the normal feature planner instead of treating feature cells as debug raised floor", () => {
    const plan = planLiveSpectatorTerrain(map([
      { ...cell({ x: 0, y: 0, height: 0, walkable: true, terrain: "floor" }), feature: TILE.Stairs },
      cell({ x: 0, y: 1, height: 0, walkable: true, terrain: "floor" }),
    ]));

    expect(plan.batches.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ worldTile: { x: 0, y: 0 }, feature: "stairs" }),
    ]));
    expect(plan.batches.floors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ worldTile: { x: 0, y: 0 } }),
    ]));
  });

  it("uses authoritative surface, biome, and territory identity from the map payload", () => {
    const prepared = createSpectatorTerrainSource(map([
      cell({ x: 0, y: 0, height: 2, walkable: false, terrain: "floor", surface: "floor", biome: BIOME.Pools, territory: 1 }),
    ]));

    expect(prepared.source.surfaceAt?.(0, 0)).toBe("floor");
    expect(prepared.source.territoryAt?.(0, 0)).toBe(1);
    expect(prepared.biomeAt(0, 0)).toBe(BIOME.Pools);
  });

  it("keeps gameplay material roles for territory floors and every wall case", () => {
    expect(TERRAIN_TILESETS[BIOME.Pools].path).toBe(TERRAIN_TILESETS[BIOME.Maze].path);
    expect(TERRAIN_TILESETS[BIOME.Ruins].path).toBe(TERRAIN_TILESETS[BIOME.Maze].path);
    expect(terrainFloorRole("floor", 0)).toBe("territory-goblin-floor");
    expect(terrainFloorRole("floor", 1)).toBe("territory-spider-floor");
    expect(terrainFloorRole("floor", 2)).toBe("territory-gaol-floor");
    expect(terrainFloorRole("bedrock", 1)).toBe("bedrock");
    expect(terrainWallRole({ territory: 1 }, 1)).toBe(SPIDER_WALL_ROLE);
    expect(terrainWallRole({ territory: 1, topSegment: false }, 1)).toBe("south-face");
    expect(terrainWallRole({ territory: 2, topSegment: false }, 1)).toBe("territory-gaol-wall");
    expect(terrainWallRole({ territory: 1, voidWall: true }, 1)).toBe("void-wall-face");
    expect(terrainWallRole({ territory: 1, stairWall: true }, 1)).toBe("stair-wall-face");
    expect(terrainWallRole({ territory: 1, wallFeature: { feature: "door", topHeight: 1 } }, 1)).toBe("door");
  });

  it("applies a wall feature only to its matching multi-height segment", () => {
    const segments = terrainWallSegments(0, 3);
    const wall = { territory: 1, wallFeature: { feature: "door" as const, topHeight: 2 } };

    expect(segments.map(({ bottom, height }) => bottom + height)).toEqual([1, 2, 3]);
    expect(segments.map(({ bottom, height }) => terrainWallRole(wall, bottom + height)))
      .toEqual([SPIDER_WALL_ROLE, "door", SPIDER_WALL_ROLE]);
  });
});

function map(cells: readonly AdminMapCell[]): AdminMap {
  return {
    level: "dungeon",
    floor: 1,
    center: { x: 0.5, y: 0.5 },
    radius: 4,
    cells: [...cells],
    entities: [],
  };
}

function cell(input: Omit<AdminMapCell, "feature">): AdminMapCell {
  return { ...input, feature: 0 };
}
