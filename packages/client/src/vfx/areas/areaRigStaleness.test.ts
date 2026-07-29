import { describe, expect, it } from "vitest";
import { rigIsStale } from "./areaRigStaleness.js";

describe("rigIsStale", () => {
  it("is stale when there is no cached rig yet", () => {
    expect(rigIsStale(undefined, { sprite: "oil", effectId: "area-oil" })).toBe(true);
  });

  it("is not stale when the cached sprite still matches the current one", () => {
    expect(rigIsStale({ sprite: "fire", effectId: "area-fire" }, { sprite: "fire", effectId: "area-fire" })).toBe(false);
  });

  it("is stale when the tile's sprite changed in place (oil caught fire)", () => {
    expect(rigIsStale({ sprite: "oil", effectId: "area-oil" }, { sprite: "fire", effectId: "area-fire" })).toBe(true);
  });

  it("is stale when an effect changes while deliberately sharing a sprite recipe", () => {
    expect(rigIsStale({ sprite: "smoke", effectId: "area-smoke-a" }, { sprite: "smoke", effectId: "area-smoke-b" })).toBe(true);
  });
});
