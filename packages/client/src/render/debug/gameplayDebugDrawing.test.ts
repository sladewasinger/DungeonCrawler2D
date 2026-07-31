import { afterEach, describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import {
  resetViewOrientation,
  setViewOrientation,
} from "../view/transform/viewState.js";
import { gameplayDebugScreenPoint } from "./gameplayDebugDrawing.js";

afterEach(resetViewOrientation);

describe("gameplay debug projection", () => {
  it("projects hurtbox elevation through the same seam as entity feet", () => {
    expect(gameplayDebugScreenPoint({ x: 3, y: 5, z: 2 })).toEqual({
      x: 3 * SCREEN_TILE_PX,
      y: 3 * SCREEN_TILE_PX,
    });
  });

  it("keeps elevation when the world view is rotated", () => {
    setViewOrientation(90);
    expect(gameplayDebugScreenPoint({ x: 1, y: 0, z: 2 })).toEqual({
      x: 0,
      y: -3 * SCREEN_TILE_PX,
    });
  });
});
