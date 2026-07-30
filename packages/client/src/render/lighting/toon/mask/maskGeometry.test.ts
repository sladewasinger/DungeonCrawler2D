import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import { toonMaskTileFor } from "./maskGeometry.js";

describe("toon mask geometry", () => {
  it("projects negative-height floors below their world row", () => {
    const tile = toonMaskTileFor({
      world: { groundAt: () => -1 },
      x: 3,
      y: 4,
      orientation: 0,
    });

    expect(tile.viewX).toBe(3 * SCREEN_TILE_PX);
    expect(tile.topY).toBe(5 * SCREEN_TILE_PX);
    expect(tile.height).toBe(SCREEN_TILE_PX);
  });

  it("covers a raised cap and its projected wall face", () => {
    const tile = toonMaskTileFor({
      world: { groundAt: () => 2 },
      x: 3,
      y: 4,
      orientation: 0,
    });

    expect(tile.topY).toBe(2 * SCREEN_TILE_PX);
    expect(tile.height).toBe(3 * SCREEN_TILE_PX);
  });
});
