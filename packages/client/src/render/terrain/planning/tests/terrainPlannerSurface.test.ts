import { describe, expect, it } from "vitest";
import {
  planTerrain,
  TERRAIN_KINDS,
  TERRAIN_SURFACES,
} from "../terrainPlanner.js";

describe("terrain surface planning", () => {
  it("marks a bedrock cap without changing its finite wall geometry", () => {
    const plan = planTerrain({
      voidTerrain: false,
      terrainAt: () => TERRAIN_KINDS.Floor,
      surfaceAt: (x, y) => x === 0 && y === 0
        ? TERRAIN_SURFACES.Bedrock
        : TERRAIN_SURFACES.Floor,
      heightAt: (x, y) => x === 0 && y === 0 ? 2 : 0,
    }, {
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      orientation: 0,
    });

    expect(plan.batches.floors[0]).toMatchObject({
      kind: "floor",
      surface: TERRAIN_SURFACES.Bedrock,
      height: 2,
    });
    expect(plan.batches.southFaces[0]).toMatchObject({
      topHeight: 2,
      bottomHeight: 0,
    });
    expect(plan.batches.southFaces[0]?.voidWall).not.toBe(true);
  });
});
