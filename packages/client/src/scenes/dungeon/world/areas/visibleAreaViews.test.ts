import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { Connection } from "../../../../net/connection/connection.js";
import { createDungeonSceneState } from "../../orchestration/state.js";
import {
  visibleAreaMarginPx,
  visibleAreaViews,
} from "./visibleAreaViews.js";

const VIEW = {
  x: 0,
  y: 0,
  right: SCREEN_TILE_PX,
  bottom: SCREEN_TILE_PX,
} as unknown as Phaser.Geom.Rectangle;

function connectionWithAreas(areaTiles: ReadonlyMap<string, string>): Connection {
  return { areaTiles, areaTileLayers: new Map() } as unknown as Connection;
}

describe("visible area VFX camera margins", () => {
  it("keeps the standard two-tile margin unchanged", () => {
    expect(visibleAreaMarginPx(false)).toBe(2 * SCREEN_TILE_PX);
  });

  it("retains one bounded tile for constrained area lights", () => {
    const state = createDungeonSceneState();
    const areas = new Map([
      ["-2,0", "area-fire"],
      ["-1,0", "area-fire"],
    ]);

    visibleAreaViews({
      connection: connectionWithAreas(areas),
      world: { groundAt: () => 0 },
      state,
      view: VIEW,
      constrainedPresentation: true,
    });

    expect(state.areaViews.map(({ id }) => id)).toEqual(["-1,0:area-fire"]);
    expect(visibleAreaMarginPx(true)).toBe(SCREEN_TILE_PX);
  });
});
