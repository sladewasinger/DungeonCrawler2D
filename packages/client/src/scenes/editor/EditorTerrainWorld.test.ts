import { describe, expect, it } from "vitest";
import {
  BIOME,
  DISTRICT,
  generateFiniteFloor,
  TERRAIN,
  TILE,
  type FloorBounds,
  type GeneratedFloor,
} from "@dc2d/engine";
import {
  planTerrain,
  VOID_SOUTH_FACE_MODES,
} from "../../render/terrain/planning/terrainPlanner.js";
import { createTerrainSource } from "../../render/terrain/runtime/source.js";
import { EditorTerrainWorld } from "./EditorTerrainWorld.js";
import { EDITOR_FLOOR } from "./editorSeed.js";

const BOUNDS: FloorBounds = {
  minX: -16, minY: -16, width: 32, height: 32, maxX: 15, maxY: 15,
  minChunkX: -1, minChunkY: -1, maxChunkX: 0, maxChunkY: 0,
};

describe("finite editor terrain world", () => {
  it("uses finite floor data while retaining local edit overlays", () => {
    const floor = fixtureFloor();
    const world = new EditorTerrainWorld(floor);
    const point = firstEditablePoint(world);
    const baseHeight = world.heightAt(point.x, point.y);
    expect(world.generatedFloor).toBe(floor);
    expect(world.floor).toBe(EDITOR_FLOOR);
    expect(world.floorBounds.width).toBeGreaterThan(20);
    world.raiseAt(point.x, point.y);
    expect(world.heightAt(point.x, point.y)).toBe(baseHeight + 1);
    world.reset();
    expect(world.heightAt(point.x, point.y)).toBe(baseHeight);
  });

  it("exposes generated biome profiles to the normal terrain renderer", () => {
    const floor = fixtureFloor();
    floor.biome[0] = 1;
    const world = new EditorTerrainWorld(floor);

    expect(world.biomeAtWorldTile(BOUNDS.minX, BOUNDS.minY)).toEqual({
      district: DISTRICT.Flooded,
      biome: BIOME.Pools,
    });
    expect(world.biomeAtWorldTile(BOUNDS.minX - 1, BOUNDS.minY)).toBeNull();
  });

  it("round-trips authored height and fixture overlays through the safe map format", () => {
    const world = new EditorTerrainWorld(fixtureFloor());
    const point = firstEditablePoint(world);
    world.raiseAt(point.x, point.y);
    world.paintAt(point.x, point.y, "safe");
    const serialized = world.exportMap();

    world.reset();
    world.importMap(serialized);

    expect(world.heightAt(point.x, point.y)).toBe(1);
    expect(world.fixtureAt(point.x, point.y)).toBe("safe");
    expect(() => world.importMap(serialized.replace('"version": 1', '"version": 9'))).toThrow("unsupported");
  });

  it.each([1, 2])("opens an exact south-facing VOID edge in generated seed %i", (worldSeed) => {
    const world = new EditorTerrainWorld(generateFiniteFloor({ worldSeed, floor: EDITOR_FLOOR }));
    const edge = ordinarySouthVoidEdge(world.generatedFloor);
    const plan = planTerrain(createTerrainSource(world), {
      bounds: { ...edge, width: 1, height: 1 }, orientation: 0,
    });

    expect(world.voidSouthFaceMode).toBe(VOID_SOUTH_FACE_MODES.OpenEdges);
    expect(plan.batches.southFaces).toEqual([]);
    expect(plan.batches.cliffEdges[0]?.voidBoundary).toBe(true);
  });
});

function fixtureFloor(): GeneratedFloor {
  const cells = BOUNDS.width * BOUNDS.height;
  return {
    worldSeed: 7, floor: EDITOR_FLOOR, voidTerrain: true, configuration: { stairTreadCount: 3 } as GeneratedFloor["configuration"],
    identity: { seed: 7, generatorVersion: 1, retryIndex: 0, configurationFingerprint: "fixture", fingerprint: "fixture", bounds: BOUNDS },
    bounds: BOUNDS,
    tiles: new Uint8Array(cells).fill(TILE.Floor), terrain: new Uint8Array(cells).fill(TERRAIN.Floor),
    features: new Uint8Array(cells), featureFaces: new Uint8Array(cells), featureHeight: new Float32Array(cells),
    height: new Float32Array(cells), zones: new Uint8Array(cells), semantic: new Uint8Array(cells),
    biome: new Uint8Array(cells), region: new Uint16Array(cells), territory: new Uint8Array(cells),
    territories: [], territoryLayouts: [], protectedCells: new Uint8Array(cells),
    roomIds: new Int16Array(cells), roomWallIds: new Int16Array(cells), featureIds: new Int16Array(cells),
    rooms: [], connectors: [], routes: [], featureStamps: [], downStairways: [], upStairway: null,
    safeRooms: [], miniBossArenas: [], bossArena: null, spawn: { x: 0, y: 0 },
    spawnExterior: { id: "fixture", kind: "fixture", bounds: { x0: 0, y0: 0, x1: 0, y1: 0 }, ports: [], protectedCells: [] },
    topology: {} as GeneratedFloor["topology"],
  };
}

function firstEditablePoint(world: EditorTerrainWorld): { readonly x: number; readonly y: number } {
  for (let y = BOUNDS.minY; y <= BOUNDS.maxY; y++) {
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x++) {
      if (world.terrainAt(x, y) === TERRAIN.Floor) return { x, y };
    }
  }
  throw new Error("finite editor floor has no editable cell");
}

function ordinarySouthVoidEdge(floor: GeneratedFloor): { readonly x: number; readonly y: number } {
  const { bounds } = floor;
  for (let y = bounds.minY; y < bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const index = (y - bounds.minY) * bounds.width + x - bounds.minX;
      const south = index + bounds.width;
      if (floor.terrain[index] === TERRAIN.Floor && floor.terrain[south] === TERRAIN.Void &&
          floor.features[index] === TILE.Floor) return { x, y };
    }
  }
  throw new Error("generated floor has no ordinary south-facing VOID edge");
}
