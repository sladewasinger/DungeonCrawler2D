import { describe, expect, it } from "vitest";
import { findChunkPoi, isInsidePoiFootprint } from "./poiStamper.js";
import { sampleWorldTile } from "./biomeSampler.js";
import { GroundKind } from "./types.js";

describe("poiStamper", () => {
  it("keeps the spawn chunk free of POIs and deterministically guarantees nearby landmarks", () => {
    expect(findChunkPoi(1337, 0, 0)).toBeNull();
    const campA = findChunkPoi(1337, 1, 0);
    const campB = findChunkPoi(1337, 1, 0);
    const ruins = findChunkPoi(1337, -1, 0);
    expect(campA?.kind).toBe("bandit-camp");
    expect(campA).toEqual(campB);
    expect(ruins?.kind).toBe("ancient-ruins");
  });

  it("places POIs only on flat dry 7x7 clearings outside immediate spawn", () => {
    const camp = findChunkPoi(1337, 1, 0);
    expect(camp).not.toBeNull();
    if (!camp) return;
    const cx = Math.floor(camp.centerX);
    const cy = Math.floor(camp.centerY);
    expect(Math.hypot(cx, cy)).toBeGreaterThanOrEqual(15);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        expect(isInsidePoiFootprint(camp, cx + dx, cy + dy)).toBe(true);
        const tile = sampleWorldTile(1337, cx + dx, cy + dy);
        expect(tile.ground).not.toBe(GroundKind.DeepWater);
        expect(tile.ground).not.toBe(GroundKind.ShallowWater);
        expect(tile.elevation).toBe(camp.elevation);
      }
    }
  });
});
