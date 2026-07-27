/** Covers the terrain streaming buffer used to avoid frequent full mesh rebuilds. */
import { describe, expect, it } from "vitest";
import { needsTerrainRefresh, terrainRefreshDistance } from "./terrainStreaming.js";

describe("terrain streaming", () => {
  it("preserves an edge buffer before refreshing geometry", () => {
    expect(terrainRefreshDistance(26)).toBe(3);
    expect(needsTerrainRefresh({ x: 0, z: 0 }, { x: 3, z: 0 }, 26)).toBe(false);
    expect(needsTerrainRefresh({ x: 0, z: 0 }, { x: 4, z: 0 }, 26)).toBe(true);
  });

  it("keeps a usable buffer at the closest view distance", () => {
    expect(terrainRefreshDistance(18)).toBe(2);
  });
});
