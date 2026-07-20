import { describe, expect, it } from "vitest";
import { rigIsStale } from "./areaRigStaleness.js";

describe("rigIsStale", () => {
  it("is stale when there is no cached rig yet", () => {
    expect(rigIsStale(undefined, "oil")).toBe(true);
  });

  it("is not stale when the cached sprite still matches the current one", () => {
    expect(rigIsStale("fire", "fire")).toBe(false);
  });

  it("is stale when the tile's sprite changed in place (oil caught fire)", () => {
    expect(rigIsStale("oil", "fire")).toBe(true);
  });

  it("is stale when fire+wet met and became steam", () => {
    expect(rigIsStale("fire", "steam")).toBe(true);
  });
});
