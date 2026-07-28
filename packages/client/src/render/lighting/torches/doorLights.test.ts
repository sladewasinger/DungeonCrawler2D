import {
  FEATURE_FACE,
  TILE,
  type FeatureFace,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { doorLightPositions, type DoorTileRead } from "./doorLights.js";

function doorWorld(face: FeatureFace, height: number): DoorTileRead {
  return {
    featureAt: (x, y) => x === 4 && y === 5 ? TILE.DoorSafeRoom : TILE.Floor,
    featureFaceAt: () => face,
    featureHeightAt: () => height,
  };
}

describe("doorLightPositions", () => {
  it("anchors a wall door's glow to the center of its authored face", () => {
    const lights = doorLightPositions(
      doorWorld(FEATURE_FACE.South, 1),
      { x0: 4, y0: 5, x1: 5, y1: 6 },
    );

    expect(lights).toEqual([{
      wx: 4,
      wy: 5,
      x: 4.5,
      y: 6,
      projectionHeight: 0.5,
    }]);
  });

  it("keeps a top-mounted portal glow at its authored elevation", () => {
    const lights = doorLightPositions(
      doorWorld(FEATURE_FACE.Top, 2),
      { x0: 4, y0: 5, x1: 5, y1: 6 },
    );

    expect(lights[0]).toMatchObject({
      x: 4.5,
      y: 5.5,
      projectionHeight: 2,
    });
  });
});
