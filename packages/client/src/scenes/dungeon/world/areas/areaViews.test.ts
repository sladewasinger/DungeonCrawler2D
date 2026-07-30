import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import { AREA_NEIGHBOR } from "../../../../vfx/areas/puddles/areaTileTopology.js";
import {
  buildAreaTileViews,
  buildAreaTileViewsInto,
} from "./areaViews.js";
import type { AreaGroundSampler } from "./areaCellSurface.js";

const flatGround = () => 0;
const FIRE_AREA = "area-fire";
const FIRST_FIRE_TILE_ID = "0,0:area-fire";

function areaViews(
  areaTiles: ReadonlyMap<string, string>,
  groundAt: AreaGroundSampler = flatGround,
): ReturnType<typeof buildAreaTileViews> {
  return buildAreaTileViews({ areaTiles, groundAt });
}

function onlyView(
  views: ReturnType<typeof buildAreaTileViews>,
) {
  const view = views[0];
  if (!view) throw new Error("expected one area view");
  return view;
}

describe("buildAreaTileViews", () => {
  it("resolves content sprites at the sampled terrain surface", () => {
    const [view] = areaViews(new Map([["3,4", FIRE_AREA]]));
    expect(view).toMatchObject({
      id: "3,4:area-fire",
      effectId: "area-fire",
      x: 3.5,
      y: 4.5,
      groundHeight: 0,
      sprite: "fire",
      neighborMask: 0,
    });
  });

  it("projects positive and negative terrain heights from one canonical surface", () => {
    const tiles = new Map([["0,0", FIRE_AREA]]);
    const raised = onlyView(areaViews(tiles, () => 2));
    const lowered = onlyView(areaViews(tiles, () => -1));
    expect(raised.groundHeight).toBe(2);
    expect(lowered.groundHeight).toBe(-1);
    expect(raised.screenX).toBe(lowered.screenX);
    expect(lowered.screenY - raised.screenY).toBe(3 * SCREEN_TILE_PX);
  });

  it("skips unknown definitions and preserves co-located compound layers", () => {
    const areaTiles = new Map([["0,0", FIRE_AREA], ["1,0", "unknown"]]);
    const areaLayers = new Map<string, readonly string[]>([
      ["0,0", ["area-oil", FIRE_AREA]],
    ]);
    const views: ReturnType<typeof buildAreaTileViews> = [];
    buildAreaTileViewsInto({
      areaTiles,
      areaLayers,
      groundAt: () => 2,
      bounds: undefined,
      marginPx: 0,
      views,
      records: [],
    });
    expect(views.map(({ id }) => id)).toEqual([
      "0,0:area-oil",
      FIRST_FIRE_TILE_ID,
    ]);
    expect(views.map(({ groundHeight }) => groundHeight)).toEqual([2, 2]);
    expect(views[0]?.screenY).toBe(views[1]?.screenY);
  });

  it("joins equal-height cardinal material cells but not a cliff edge", () => {
    const tiles = new Map([["0,0", "area-wet"], ["1,0", "area-wet"]]);
    const joined = areaViews(tiles, () => 1);
    expect(joined.map(({ neighborMask }) => neighborMask)).toEqual([
      AREA_NEIGHBOR.east,
      AREA_NEIGHBOR.west,
    ]);

    const split = areaViews(tiles, (x) => x < 1 ? 1 : 2);
    expect(split.map(({ neighborMask }) => neighborMask)).toEqual([0, 0]);
  });

  it("limits views to the elevated camera neighborhood", () => {
    const views = buildAreaTileViews({
      areaTiles: new Map([["0,0", FIRE_AREA], ["100,100", FIRE_AREA]]),
      groundAt: flatGround,
      bounds: { x: -100, y: -100, right: 100, bottom: 100 },
    });
    expect(views.map(({ id }) => id)).toEqual([FIRST_FIRE_TILE_ID]);
  });

  it("rewrites caller-owned records across sustained frames", () => {
    const views: ReturnType<typeof buildAreaTileViews> = [];
    const records: ReturnType<typeof buildAreaTileViews> = [];
    const tiles = new Map([["0,0", FIRE_AREA]]);
    const empty = new Map<string, string>();
    buildAreaTileViewsInto({
      areaTiles: tiles,
      groundAt: flatGround,
      bounds: undefined,
      marginPx: 0,
      views,
      records,
    });
    const first = views[0];
    for (let frame = 0; frame < 1_000; frame++) {
      buildAreaTileViewsInto({
        areaTiles: frame % 2 === 0 ? tiles : empty,
        groundAt: flatGround,
        bounds: undefined,
        marginPx: 0,
        views,
        records,
      });
      if (frame % 2 === 0) expect(views[0]).toBe(first);
    }
    expect(records).toHaveLength(1);
  });

  it("does not create area VFX outside the toon visibility field", () => {
    const views = buildAreaTileViews({
      areaTiles: new Map([[
        "0,0",
        FIRE_AREA,
      ], [
        "1,0",
        FIRE_AREA,
      ]]),
      groundAt: flatGround,
      terrainVisibility: {
        isWorldPositionVisible: (x) => x < 1,
      },
    });
    expect(views.map(({ id }) => id)).toEqual([FIRST_FIRE_TILE_ID]);
  });
});
