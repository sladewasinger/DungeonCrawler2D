import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../boot/assetManifest.js";
import { depthForEntity } from "../render/entities/depthSort.js";
import { groundPlaneDepth } from "./groundPlaneDepth.js";

describe("groundPlaneDepth", () => {
  it("sorts raised ground by its projected Z-shifted row", () => {
    const rawRow = 10;
    expect(groundPlaneDepth(rawRow * SCREEN_TILE_PX, 2))
      .toBe(depthForEntity(8));
  });

  it("includes each droplet's screen-space scatter in its depth", () => {
    expect(groundPlaneDepth(10 * SCREEN_TILE_PX, 1, SCREEN_TILE_PX / 2))
      .toBe(depthForEntity(9.5));
  });
});
