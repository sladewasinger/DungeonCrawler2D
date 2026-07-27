import { describe, expect, it } from "vitest";
import { buildAreaTileViews, buildAreaTileViewsInto } from "./areaViews.js";

describe("buildAreaTileViews", () => {
  it("resolves a known area defId to its content-declared sprite kind, centered in the tile", () => {
    const views = buildAreaTileViews(new Map([["3,4", "area-fire"]]));
    expect(views).toEqual([{ id: "3,4", effectId: "area-fire", x: 3.5, y: 4.5, sprite: "fire" }]);
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

  it("keeps a tile id stable while carrying the replacement content effect id", () => {
    const oil = buildAreaTileViews(new Map([["2,6", "area-oil"]]))[0];
    const fire = buildAreaTileViews(new Map([["2,6", "area-fire"]]))[0];
    expect(oil?.id).toBe(fire?.id);
    expect([oil?.effectId, fire?.effectId]).toEqual(["area-oil", "area-fire"]);
  });

  it("limits active area rigs to the camera neighborhood", () => {
    const tiles = new Map([
      ["0,0", "area-fire"],
      ["100,100", "area-fire"],
    ]);

    const views = buildAreaTileViews(
      tiles,
      { x: -100, y: -100, right: 100, bottom: 100 },
    );

    expect(views.map(({ id }) => id)).toEqual(["0,0"]);
  });

  it("rewrites one caller-owned array and bounded record set across sustained frames", () => {
    const output: ReturnType<typeof buildAreaTileViews> = [];
    const records: ReturnType<typeof buildAreaTileViews> = [];
    const tiles = new Map([["0,0", "area-fire"]]);
    buildAreaTileViewsInto({ areaTiles: tiles, bounds: undefined, marginPx: 0, views: output, records });
    const firstRecord = output[0];
    const empty = new Map<string, string>();

    for (let frame = 0; frame < 1_000; frame++) {
      const source = frame % 2 === 0 ? tiles : empty;
      expect(buildAreaTileViewsInto({ areaTiles: source, bounds: undefined, marginPx: 0, views: output, records }))
        .toBe(output);
      if (source.size > 0) expect(output[0]).toBe(firstRecord);
    }
    expect(records).toHaveLength(1);
  });
});
