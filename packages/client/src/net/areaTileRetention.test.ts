import { describe, expect, it } from "vitest";
import { pruneAreaTiles } from "./areaTileRetention.js";

describe("pruneAreaTiles", () => {
  it("bounds a long moving session to the current replication neighborhood", () => {
    const areas = new Map<string, string>();
    let maximumRetained = 0;
    for (let centerX = 0; centerX < 3_600; centerX++) {
      for (let offset = -20; offset <= 20; offset++) {
        areas.set(`${centerX},${offset}`, "area-fire");
      }
      pruneAreaTiles({ areaTiles: areas, centerX, centerY: 0, radius: 40 });
      maximumRetained = Math.max(maximumRetained, areas.size);
    }

    expect(maximumRetained).toBeLessThanOrEqual(81 * 41);
    expect(areas.size).toBeLessThanOrEqual(81 * 41);
    expect(areas.has("0,0")).toBe(false);
    expect(areas.has("3599,0")).toBe(true);
  });
});
