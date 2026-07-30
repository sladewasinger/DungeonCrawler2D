import { describe, expect, it } from "vitest";
import { pruneAreaTiles } from "./areaTileRetention.js";

describe("pruneAreaTiles", () => {
  it("uses the circular radius boundary", () => {
    const areas = new Map([
      ["40,0", "edge"],
      ["41,0", "outside"],
      ["28,28", "corner"],
      ["29,29", "outside-corner"],
    ]);

    pruneAreaTiles({ areaTiles: areas, centerX: 0, centerY: 0, radius: 40 });

    expect(areas.has("40,0")).toBe(true);
    expect(areas.has("41,0")).toBe(false);
    expect(areas.has("28,28")).toBe(true);
    expect(areas.has("29,29")).toBe(false);
  });

  it("retains the new neighborhood after the center moves", () => {
    const areas = new Map([
      ["0,0", "old-center"],
      ["40,0", "old-edge"],
      ["100,0", "new-center"],
    ]);

    pruneAreaTiles({ areaTiles: areas, centerX: 100, centerY: 0, radius: 40 });

    expect(areas.has("0,0")).toBe(false);
    expect(areas.has("40,0")).toBe(false);
    expect(areas.has("100,0")).toBe(true);
  });
});
