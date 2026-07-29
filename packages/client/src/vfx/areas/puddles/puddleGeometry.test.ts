import { describe, expect, it } from "vitest";
import { AREA_NEIGHBOR } from "./areaTileTopology.js";
import { puddleRectFor } from "./puddleGeometry.js";

const rect = (neighborMask: number) => puddleRectFor({
  tile: { x: 24, y: 24, neighborMask },
  tileSize: 48,
  inset: 4,
  radius: 13,
});

describe("puddle geometry", () => {
  it("rounds and insets every edge of a lone puddle tile", () => {
    expect(rect(0)).toEqual({
      x: 4,
      y: 4,
      width: 40,
      height: 40,
      radius: { tl: 13, tr: 13, br: 13, bl: 13 },
    });
  });

  it("extends connected edges to the tile boundary without rounded internal seams", () => {
    expect(rect(AREA_NEIGHBOR.east)).toMatchObject({
      x: 4,
      width: 44,
      radius: { tl: 13, tr: 0, br: 0, bl: 13 },
    });
    expect(rect(AREA_NEIGHBOR.west)).toMatchObject({
      x: 0,
      width: 44,
      radius: { tl: 0, tr: 13, br: 13, bl: 0 },
    });
  });

  it("keeps only the outside corner rounded in a pooled two-axis join", () => {
    expect(rect(AREA_NEIGHBOR.east | AREA_NEIGHBOR.south).radius)
      .toEqual({ tl: 13, tr: 0, br: 0, bl: 0 });
  });
});
