import { describe, expect, it } from "vitest";
import { atlasReadinessChanged } from "./terrainAtlasReadiness.js";

describe("terrain atlas readiness", () => {
  it("invalidates a fallback room render when the atlas becomes ready", () => {
    expect(atlasReadinessChanged(undefined, false)).toBe(true);
    expect(atlasReadinessChanged(false, true)).toBe(true);
    expect(atlasReadinessChanged(true, true)).toBe(false);
  });
});
