import { describe, expect, it } from "vitest";
import {
  shouldRebuildToonVisibility,
  toonVisibilityCacheKey,
} from "./toonVisibilityCache.js";

const bounds = { x: -10, y: -8, width: 20, height: 16 };

function key(input: Partial<{
  x: number;
  y: number;
  orientation: 0 | 90 | 180 | 270;
  revision: number;
  bounds: typeof bounds;
}> = {}) {
  return toonVisibilityCacheKey({
    player: { x: input.x ?? 0.5, y: input.y ?? 0.5 },
    orientation: input.orientation ?? 0,
    tileRevision: input.revision ?? 1,
    bounds: input.bounds ?? bounds,
  });
}

describe("toon visibility cache", () => {
  it("does not rebuild inside the configured player movement quantum", () => {
    expect(shouldRebuildToonVisibility(key(), key({ x: 0.7 }))).toBe(false);
    expect(shouldRebuildToonVisibility(key(), key({ x: 1.01 }))).toBe(true);
  });

  it("rebuilds on orientation, terrain revision, or camera-footprint changes", () => {
    const previous = key();
    expect(shouldRebuildToonVisibility(previous, key({ orientation: 90 }))).toBe(true);
    expect(shouldRebuildToonVisibility(previous, key({ revision: 2 }))).toBe(true);
    expect(shouldRebuildToonVisibility(previous, key({
      bounds: { ...bounds, width: bounds.width + 1 },
    }))).toBe(true);
  });
});
