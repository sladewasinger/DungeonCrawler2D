import { describe, expect, it } from "vitest";
import { FEATURE_FACE } from "@dc2d/engine";
import { VIEW_ORIENTATIONS } from "../../../view/orientation/viewOrientation.js";
import {
  viewTileToWorld,
  worldTileToView,
} from "../../../view/transform/viewTransform.js";
import { planTerrain, TERRAIN_KINDS } from "../terrainPlanner.js";

const key = (x: number, y: number): string => `${x},${y}`;

describe("wall-feature door geometry", () => {
  it.each(VIEW_ORIENTATIONS)("never falls back to horizontal art at orientation %i", (orientation) => {
    const wall = { x: 10, y: 10 };
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: (x, y) => key(x, y) === "10,11" ? 0 : 2,
      featureAt: (x, y) => key(x, y) === key(wall.x, wall.y) ? "door" : null,
      featureFaceAt: () => FEATURE_FACE.South,
      featureHeightAt: () => 1,
    }, { bounds: { ...wall, width: 1, height: 1 }, orientation });

    expect(plan.batches.floors).toHaveLength(1);
    expect(plan.batches.features).toEqual([]);
    if (orientation === 0) {
      expect(plan.batches.southFaces[0]?.wallFeature)
        .toEqual({ feature: "door", topHeight: 1 });
    } else {
      expect(plan.batches.southFaces).toEqual([]);
    }
  });

  it("keeps a zero-elevation exit portal as a horizontal ground feature", () => {
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: () => 0,
      featureAt: () => "door",
      featureFaceAt: () => FEATURE_FACE.Top,
      featureHeightAt: () => 0,
    }, { bounds: { x: 10, y: 10, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.floors).toEqual([]);
    expect(plan.batches.features[0]?.wallMounted).toBeUndefined();
    expect(plan.batches.features[0]?.vertices.every(({ z }) => z === 0)).toBe(true);
  });

  it.each([
    [0, FEATURE_FACE.South],
    [90, FEATURE_FACE.West],
    [180, FEATURE_FACE.North],
    [270, FEATURE_FACE.East],
  ] as const)("draws a room door on its VOID collision face at orientation %i", (orientation, face) => {
    const wall = { x: 10, y: 10 };
    const wallView = worldTileToView(wall, orientation);
    const interior = viewTileToWorld({ x: wallView.x, y: wallView.y + 1 }, orientation);
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: (x, y) => key(x, y) === key(interior.x, interior.y)
        ? TERRAIN_KINDS.Floor
        : TERRAIN_KINDS.Void,
      heightAt: () => 0,
      featureAt: (x, y) => key(x, y) === key(wall.x, wall.y) ? "door" : null,
      featureFaceAt: () => face,
      featureHeightAt: () => 1,
      voidBoundaryAt: () => "flat",
    }, { bounds: { ...wall, width: 1, height: 1 }, orientation });

    expect(plan.batches.features[0]).toMatchObject({
      feature: "door",
      wallMounted: true,
      height: 1,
    });
    expect(plan.batches.features[0]?.vertices.map(({ z }) => z)).toEqual([1, 1, 0, 0]);
  });

  it("embeds a camera-facing door in an inside room wall", () => {
    const wall = { x: 10, y: 10 };
    const plan = planTerrain({
      voidTerrain: true,
      presentationAt: () => ({ mode: "inside", wallRise: 3 }),
      terrainAt: (x, y) => key(x, y) === "10,11"
        ? TERRAIN_KINDS.Floor
        : TERRAIN_KINDS.Void,
      heightAt: () => 0,
      featureAt: (x, y) => key(x, y) === key(wall.x, wall.y) ? "door" : null,
      featureFaceAt: () => FEATURE_FACE.South,
      featureHeightAt: () => 1,
    }, { bounds: { ...wall, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.voids).toEqual([]);
    expect(plan.batches.features).toEqual([]);
    expect(plan.batches.floors).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      topHeight: 3,
      bottomHeight: 0,
      wallFeature: { feature: "door", topHeight: 1 },
    });
  });
});
