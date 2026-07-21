import { afterEach, describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { resetViewOrientation, setViewOrientation } from "../view/viewState.js";
import { depthForEntityNow, worldToScreen } from "./worldToScreen.js";

afterEach(() => resetViewOrientation());

describe("worldToScreen at orientation 0", () => {
  it("is the plain world*SCREEN_TILE_PX identity — pixel-lock regression", () => {
    expect(worldToScreen(3, -2)).toEqual({ x: 3 * SCREEN_TILE_PX, y: -2 * SCREEN_TILE_PX });
  });
});

describe("worldToScreen at other orientations", () => {
  it("rotates world east to screen-north at orientation 90", () => {
    setViewOrientation(90);
    expect(worldToScreen(1, 0)).toEqual({ x: 0, y: -SCREEN_TILE_PX });
  });
});

describe("depthForEntityNow", () => {
  it("matches feetWorldY-only depth ordering at orientation 0", () => {
    expect(depthForEntityNow(0, 5)).toBeLessThan(depthForEntityNow(0, 10));
  });

  it("re-derives depth ordering from feetWorldX at orientation 90 (screen-south is now world-west)", () => {
    setViewOrientation(90);
    // At 90, view.y = -world.x, so a MORE NEGATIVE world x sorts further screen-south.
    expect(depthForEntityNow(5, 0)).toBeLessThan(depthForEntityNow(-5, 0));
  });
});
