import { describe, expect, it } from "vitest";
import { terrainDebugIsEnabled } from "./debugMode.js";

describe("terrainDebugIsEnabled", () => {
  it("enables only the compatibility debug query value", () => {
    expect(terrainDebugIsEnabled("?terrain4Debug=1")).toBe(true);
    expect(terrainDebugIsEnabled("?terrain4Debug=0")).toBe(false);
    expect(terrainDebugIsEnabled("?debug=1")).toBe(false);
  });
});
