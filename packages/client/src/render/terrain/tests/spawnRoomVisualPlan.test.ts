import { BIOME, FEATURE_FACE, TILE, type World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { finiteTerrainWorldFixture } from "../../../testing/terrainWorldFixture.js";
import { atlasDraws } from "../batch/atlasBatch.js";
import type { TerrainScreenProjection } from "../batch/quadBatch.js";
import { terrainFloorRole } from "../material/terrainMaterialRoles.js";
import { planTerrain } from "../planning/terrainPlanner.js";
import { createTerrainSource } from "../runtime/source.js";

const PROJECTION: TerrainScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};

describe("spawn-room visual plan", () => {
  it("projects the authoritative facade, exit door, and landing materials", () => {
    const { world } = finiteTerrainWorldFixture(false);
    const door = findExitDoor(world);
    const landing = { x: door.x, y: door.y + 1 };
    const source = createTerrainSource(world);
    const plan = planTerrain(source, {
      bounds: { x: door.x, y: door.y, width: 1, height: 2 },
      orientation: 0,
    });
    const draws = atlasDraws(plan.batches, {
      projection: PROJECTION,
      biomeAt: ({ x, y }) => world.biomeAtWorldTile(x, y)?.biome ?? BIOME.Maze,
      territoryAt: ({ x, y }) => world.territoryAtWorldTile(x, y),
      debug: false,
    });

    expect(world.featureFaceAt(door.x, door.y)).toBe(FEATURE_FACE.South);
    expect(source.featureAt?.(door.x, door.y)).toBeNull();
    expect(source.propAt?.(door.x, door.y)).toBe("spawn-house");
    expect(plan.batches.floors).toEqual(expect.arrayContaining([
      expect.objectContaining({ worldTile: door, surface: "floor" }),
      expect.objectContaining({ worldTile: landing, surface: "floor" }),
    ]));
    expect(plan.batches.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ worldTile: door, prop: "spawn-house", featureFace: FEATURE_FACE.South }),
    ]));
    expect(draws).toEqual(expect.arrayContaining([
      expect.objectContaining({
        worldTile: door,
        role: terrainFloorRole("floor", world.territoryAtWorldTile(door.x, door.y)),
      }),
      expect.objectContaining({
        worldTile: landing,
        role: terrainFloorRole("floor", world.territoryAtWorldTile(landing.x, landing.y)),
      }),
    ]));
  }, 30_000);
});

function findExitDoor(world: World): { readonly x: number; readonly y: number } {
  const bounds = world.floorBounds;
  if (!bounds) throw new Error("finite terrain fixture has no floor bounds");
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (world.featureAt(x, y) === TILE.DoorExit) return { x, y };
    }
  }
  throw new Error("finite terrain fixture has no spawn-room exit door");
}
