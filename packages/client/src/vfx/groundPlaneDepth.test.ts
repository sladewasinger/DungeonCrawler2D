import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../boot/assetManifest.js";
import {
  depthForCapOccluder,
  depthForEntity,
  depthForOccluder,
} from "../render/entities/depthSort.js";
import { groundedVisualPlacement } from "./groundPlaneDepth.js";

describe("groundedVisualPlacement", () => {
  it.each([0, 0.5, 1])(
    "projects a z=%s corpse without changing its grounded depth row",
    (groundHeight) => {
      const rawRow = 10;
      const placement = groundedVisualPlacement(
        rawRow * SCREEN_TILE_PX,
        groundHeight,
        "corpse",
      );
      expect(placement).toMatchObject({
        groundedRow: rawRow,
        projectedScreenY: (rawRow - groundHeight) * SCREEN_TILE_PX,
        depth: depthForEntity(rawRow) - 0.3,
        groundHeight,
        layer: "corpse",
      });
    },
  );

  it("keeps every death layer above its own cap and behind a true south wall", () => {
    const row = 10;
    const cap = depthForCapOccluder(row);
    const wall = depthForOccluder(row + 1);
    for (const layer of [
      "blood",
      "corpse",
      "corpseFragment",
      "item",
    ] as const) {
      const depth = groundedVisualPlacement(
        row * SCREEN_TILE_PX,
        1,
        layer,
      ).depth;
      expect(depth, layer).toBeGreaterThan(cap);
      expect(depth, layer).toBeLessThan(wall);
    }
  });

  it("applies screen-space scatter to both the projected footprint and its depth", () => {
    const placement = groundedVisualPlacement(
      10 * SCREEN_TILE_PX,
      1,
      "blood",
      SCREEN_TILE_PX / 2,
    );
    expect(placement.projectedScreenY).toBe(9.5 * SCREEN_TILE_PX);
    expect(placement.depth).toBe(depthForEntity(10.5) - 0.35);
  });

  it("handles stairs, chasms, and teleports as projection changes, not depth changes", () => {
    const rawRow = 14.25;
    const heights = [-1, -0.5, 0, 0.5, 1];
    const placements = heights.map((height) =>
      groundedVisualPlacement(
        rawRow * SCREEN_TILE_PX,
        height,
        "corpseFragment",
      ));
    expect(placements.map(({ depth }) => depth))
      .toEqual(heights.map(() => depthForEntity(rawRow) - 0.25));
    expect(placements.map(({ projectedScreenY }) => projectedScreenY))
      .toEqual(heights.map((height) => (rawRow - height) * SCREEN_TILE_PX));
  });
});
