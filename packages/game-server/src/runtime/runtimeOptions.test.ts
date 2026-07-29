/** Verifies that enemy AI is live by default and can still be frozen explicitly. */
import { describe, expect, it } from "vitest";
import { enemiesAreFrozen, voidTerrainIsEnabled } from "./runtimeOptions.js";

describe("enemiesAreFrozen", () => {
  it("enables enemy AI when the flag is absent or disabled", () => {
    expect(enemiesAreFrozen(undefined)).toBe(false);
    expect(enemiesAreFrozen("0")).toBe(false);
  });

  it("freezes enemy AI only when explicitly enabled", () => {
    expect(enemiesAreFrozen("1")).toBe(true);
  });
});

describe("voidTerrainIsEnabled", () => {
  it("preserves VOID terrain unless startup explicitly disables it", () => {
    expect(voidTerrainIsEnabled(undefined)).toBe(true);
    expect(voidTerrainIsEnabled("1")).toBe(true);
    expect(voidTerrainIsEnabled("true")).toBe(true);
    expect(voidTerrainIsEnabled("0")).toBe(false);
    expect(voidTerrainIsEnabled("off")).toBe(false);
  });

  it("rejects ambiguous startup values", () => {
    expect(() => voidTerrainIsEnabled("maybe")).toThrow(/VOID_TERRAIN/);
  });
});
