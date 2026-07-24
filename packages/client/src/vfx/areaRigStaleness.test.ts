import { describe, expect, it } from "vitest";
import { rigIsStale } from "./areaRigStaleness.js";

describe("rigIsStale", () => {
  it("is stale when there is no cached rig yet", () => {
    expect(rigIsStale(undefined, undefined, "oil", "area-oil")).toBe(true);
  });

  it("is not stale when the cached sprite still matches the current one", () => {
    expect(rigIsStale("fire", "area-fire", "fire", "area-fire")).toBe(false);
  });

  it("is stale when the tile's sprite changed in place (oil caught fire)", () => {
    expect(rigIsStale("oil", "area-oil", "fire", "area-fire")).toBe(true);
  });

  it("is stale when an effect changes while deliberately sharing a sprite recipe", () => {
    expect(rigIsStale("smoke", "area-smoke-a", "smoke", "area-smoke-b")).toBe(true);
  });
});
