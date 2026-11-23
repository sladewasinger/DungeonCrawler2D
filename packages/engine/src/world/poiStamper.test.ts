import { describe, expect, it } from "vitest";
import { findChunkPoi, isInsidePoiFootprint } from "./poiStamper.js";
import { getPoiGuardRoster } from "./poiLayouts.js";
import { sampleWorldTile } from "./biomeSampler.js";
import { GroundKind } from "./types.js";

function assertClearingRow(opts: { readonly camp: NonNullable<ReturnType<typeof findChunkPoi>>; readonly cx: number; readonly dy: number }): void {
  for (let dx = -opts.camp.radiusX; dx <= opts.camp.radiusX; dx++) {
    if (!isInsidePoiFootprint(opts.camp, opts.cx + dx, Math.floor(opts.camp.centerY) + opts.dy)) continue;
    const tile = sampleWorldTile(1337, opts.cx + dx, Math.floor(opts.camp.centerY) + opts.dy);
    expect(tile.ground).not.toBe(GroundKind.DeepWater);
    expect(tile.ground).not.toBe(GroundKind.ShallowWater);
    expect(tile.elevation).toBe(opts.camp.elevation);
  }
}

function assertClearingDry(camp: NonNullable<ReturnType<typeof findChunkPoi>>): void {
  const cx = Math.floor(camp.centerX);
  expect(Math.hypot(cx, Math.floor(camp.centerY))).toBeGreaterThanOrEqual(15);
  for (let dy = -camp.radiusY; dy <= camp.radiusY; dy++) assertClearingRow({ camp, cx, dy });
}

function countOuterPoiRow(cy: number, layouts: Set<string>): number {
  let count = 0;
  for (let cx = -6; cx <= 6; cx++) {
    if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) continue;
    const poi = findChunkPoi(1337, cx, cy);
    if (poi) { count++; layouts.add(poi.layout); }
  }
  return count;
}

function countOuterPois(): { readonly count: number; readonly layouts: Set<string> } {
  let count = 0;
  const layouts = new Set<string>();
  for (let cy = -6; cy <= 6; cy++) count += countOuterPoiRow(cy, layouts);
  return { count, layouts };
}

describe("poiStamper", () => {
  it("keeps the spawn chunk free of POIs and deterministically guarantees varied nearby landmarks", () => {
    expect(findChunkPoi(1337, 0, 0)).toBeNull();
    const campA = findChunkPoi(1337, 1, 0);
    const campB = findChunkPoi(1337, 1, 0);
    const ruins = findChunkPoi(1337, -1, 0);
    expect(campA?.kind).toBe("bandit-camp");
    expect(campA).toEqual(campB);
    expect(ruins?.kind).toBe("ancient-ruins");
    if (campA) expect(getPoiGuardRoster(campA.layout).length).toBeGreaterThanOrEqual(2);
    if (ruins) expect(getPoiGuardRoster(ruins.layout).length).toBeGreaterThanOrEqual(3);
  });

  it("places POIs cleanly on flat dry masked clearings and spreads outer world landmarks sparsely", () => {
    const camp = findChunkPoi(1337, 1, 0);
    expect(camp).not.toBeNull();
    if (camp) assertClearingDry(camp);
    const outer = countOuterPois();
    expect(outer.count).toBeGreaterThan(2);
    expect(outer.count).toBeLessThan(28);
    expect(outer.layouts.size).toBeGreaterThanOrEqual(2);
  });
});
