import { describe, expect, it } from "vitest";
import { buildAreaTileViews } from "./areaViews.js";

describe("buildAreaTileViews", () => {
  it("resolves a known area defId to its content-declared sprite kind, centered in the tile", () => {
    const views = buildAreaTileViews(new Map([["3,4", "area-fire"]]));
    expect(views).toEqual([{ id: "3,4", x: 3.5, y: 4.5, sprite: "fire" }]);
  });

  it("skips an unknown area defId rather than guessing a sprite", () => {
    const views = buildAreaTileViews(new Map([["1,1", "not-a-real-area"]]));
    expect(views).toEqual([]);
  });

  it("maps every declared area kind", () => {
    const tiles = new Map([
      ["0,0", "area-wet"],
      ["1,0", "area-oil"],
      ["2,0", "area-poison"],
      ["3,0", "area-steam"],
    ]);
    const views = buildAreaTileViews(tiles);
    expect(views.map((v) => v.sprite).sort()).toEqual(["oil", "poison", "steam", "wet"]);
  });
});
