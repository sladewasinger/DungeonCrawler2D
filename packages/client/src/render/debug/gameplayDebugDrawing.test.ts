import { afterEach, describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import {
  resetViewOrientation,
  setViewOrientation,
} from "../view/transform/viewState.js";
import { gameplayDebugScreenPoint } from "./gameplayDebugDrawing.js";
import { boxWireframe } from "./adminDebugGeometry.js";

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

  it("projects the truthful hurtbox height through every settled rotation", () => {
    const lines = boxWireframe({
      center: { x: 4, y: 7, z: 2 },
      halfWidth: 0.5,
      halfDepth: 0.5,
      height: 1.5,
      bottomOffset: 0.25,
    });
    for (const orientation of [0, 90, 180, 270]) {
      setViewOrientation(orientation);
      const base = gameplayDebugScreenPoint(lines[0]![0]!);
      const top = gameplayDebugScreenPoint(lines[1]![0]!);
      expect(top.x).toBe(base.x);
      expect(base.y - top.y).toBe(1.5 * SCREEN_TILE_PX);
    }
  });
});
