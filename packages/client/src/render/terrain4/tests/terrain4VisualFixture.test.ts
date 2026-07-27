import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { terrain4AtlasDraws, terrain4MeshBatches } from "../batch/phaser4AtlasBatch.js";
import { screenProjection } from "../runtime/terrain4RenderSupport.js";
import { TERRAIN4, planTerrain4, type Terrain4Kind, type Terrain4Source } from "../planning/terrainPlanner.js";

const FLOOR = TERRAIN4.Floor;
const VOID = TERRAIN4.Void;
const BIOMES = Object.values(BIOME);

describe("Terrain4 deterministic visual fixture", () => {
  it.each(VIEW_ORIENTATIONS)("keeps Void flat and never creates a Void wall at orientation %i", (orientation) => {
    const source = fixtureSource();
    const plan = planTerrain4(source, {
      bounds: { x: 0, y: 0, width: 8, height: 8 },
      orientation,
      seamApron: 1,
    });

    expect(plan.batches.voids.length).toBeGreaterThan(0);
    expect(plan.batches.voids.every((quad) => quad.vertices.every((vertex) => vertex.z === 0))).toBe(true);
    expect(plan.batches.southFaces.every((face) => {
      const south = viewTileToWorld({ x: face.viewTile.x, y: face.viewTile.y + 1 }, orientation);
      return source.terrainAt(face.worldTile.x, face.worldTile.y) === FLOOR && source.terrainAt(south.x, south.y) === FLOOR;
    })).toBe(true);
  });

  it("covers every biome atlas set while keeping one stable role layout", () => {
    const source = fixtureSource();
    const plan = planTerrain4(source, { bounds: { x: 0, y: 0, width: 8, height: 8 }, orientation: 0 });
    const draws = terrain4AtlasDraws(plan.batches, {
      projection: screenProjection,
      biomeAt: ({ x, y }) => BIOMES[Math.abs(x + y) % BIOMES.length] ?? BIOME.Maze,
      debug: false,
    });
    const atlasKeys = new Set(draws.map((draw) => draw.atlas.key));

    expect(atlasKeys).toEqual(new Set(["terrain4-biomes", "terrain4-pillars", "terrain4-cliffs"]));
    expect(draws.some((draw) => draw.role === "stairs")).toBe(true);
    expect(draws.some((draw) => draw.role === "door")).toBe(true);
    expect(draws.some((draw) => draw.role === "brazier")).toBe(true);
    expect(draws.every((draw, index) => index === 0 || (draw.depth ?? 0) >= (draws[index - 1]?.depth ?? 0))).toBe(true);

    const meshes = terrain4MeshBatches(draws, () => ({ width: 800, height: 880 }));
    expect(meshes.every((mesh) => mesh.vertices.length % 4 === 0 && mesh.indices.length % 4 === 0)).toBe(true);
  });
});

function fixtureSource(): Terrain4Source {
  return {
    terrainAt: (x, y): Terrain4Kind => (x === 3 || y === 5 ? VOID : FLOOR),
    heightAt: (x, y) => heightAtFixture({ x, y }),
    featureAt: (x, y) => featureAtFixture({ x, y }),
  };
}

function heightAtFixture(tile: { readonly x: number; readonly y: number }): number {
  return tile.x === 1 && tile.y === 1 ? 2 : 0;
}

function featureAtFixture(tile: { readonly x: number; readonly y: number }): "stairs" | "door" | "brazier" | null {
  return fixtureFeatures().get(`${tile.x},${tile.y}`) ?? null;
}

function fixtureFeatures(): ReadonlyMap<string, "stairs" | "door" | "brazier"> {
  return new Map([["0,0", "stairs"], ["1,0", "door"], ["2,0", "brazier"]]);
}
