import { FEATURE_FACE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView } from "../../../view/transform/viewTransform.js";
import {
  planTerrain,
  TERRAIN_KINDS,
  VOID_SOUTH_FACE_MODES,
  type TerrainSource,
} from "../terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;
const key = (x: number, y: number): string => `${x},${y}`;

describe("open VOID edge presentation", () => {
  it.each(VIEW_ORIENTATIONS)("culls only the exact Floor-to-Void screen-south face at orientation %i", (orientation) => {
    const floor = { x: 10, y: 10 };
    const view = worldTileToView(floor, orientation);
    const south = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const side = viewTileToWorld({ x: view.x + 1, y: view.y }, orientation);
    const terrain = new Map([[key(south.x, south.y), VOID], [key(side.x, side.y), VOID]]);
    const plan = planTerrain(openEdgeSource({
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? FLOOR,
    }), { bounds: { ...floor, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toEqual([]);
    expect(plan.batches.cliffEdges[0]).toMatchObject({ voidBoundary: true });
  });

  it.each(VIEW_ORIENTATIONS)("retains Floor-to-Floor height faces at orientation %i", (orientation) => {
    const floor = { x: 10, y: 10 };
    const view = worldTileToView(floor, orientation);
    const south = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const plan = planTerrain(openEdgeSource({
      terrainAt: () => FLOOR,
      heightAt: (x, y) => key(x, y) === key(south.x, south.y) ? 0 : 2,
    }), { bounds: { ...floor, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces[0]).toMatchObject({
      topHeight: 2, bottomHeight: 0,
    });
    expect(plan.batches.southFaces[0]?.voidWall).not.toBe(true);
  });

  it.each(VIEW_ORIENTATIONS)("preserves stair face rules at orientation %i", (orientation) => {
    const floor = { x: 10, y: 10 };
    const view = worldTileToView(floor, orientation);
    const south = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const plan = planTerrain(openEdgeSource({
      terrainAt: (x, y) => key(x, y) === key(south.x, south.y) ? VOID : FLOOR,
      heightAt: () => 1,
      featureAt: () => "stairs",
    }), { bounds: { ...floor, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces[0]?.stairWall).toBe(true);
  });

  it.each([
    [0, FEATURE_FACE.South],
    [90, FEATURE_FACE.West],
    [180, FEATURE_FACE.North],
    [270, FEATURE_FACE.East],
  ] as const)("preserves camera-facing door rules at orientation %i", (orientation, face) => {
    const floor = { x: 10, y: 10 };
    const view = worldTileToView(floor, orientation);
    const south = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const plan = planTerrain(openEdgeSource({
      terrainAt: (x, y) => key(x, y) === key(south.x, south.y) ? VOID : FLOOR,
      heightAt: () => 1,
      featureAt: () => "door",
      featureFaceAt: () => face,
      featureHeightAt: () => 1,
    }), { bounds: { ...floor, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces[0]?.wallFeature)
      .toEqual({ feature: "door", topHeight: 1 });
  });

  it("preserves explicit floating boundaries while respecting flat boundaries", () => {
    const plan = (boundary: "floating" | "flat") => planTerrain(openEdgeSource({
      terrainAt: (_x, y) => y === 11 ? VOID : FLOOR,
      voidBoundaryAt: () => boundary,
    }), { bounds: { x: 10, y: 10, width: 1, height: 1 }, orientation: 0 });

    expect(plan("floating").batches.southFaces[0]?.voidWall).toBe(true);
    expect(plan("flat").batches.southFaces).toEqual([]);
  });
});

function openEdgeSource(
  overrides: Partial<TerrainSource>,
): TerrainSource {
  return {
    voidTerrain: true,
    voidSouthFaceMode: VOID_SOUTH_FACE_MODES.OpenEdges,
    terrainAt: () => FLOOR,
    heightAt: () => 0,
    ...overrides,
  };
}
