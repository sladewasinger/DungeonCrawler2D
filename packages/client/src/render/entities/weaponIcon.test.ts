// Headless tests for the held-weapon icon lookup.
import { describe, expect, it } from "vitest";
import { weaponIconFrame } from "./weaponIcon.js";

describe("weaponIconFrame", () => {
  it("maps known weapon ids to their atlas icon frame", () => {
    expect(weaponIconFrame("sword")).toBe("weapon_rusty_sword");
    expect(weaponIconFrame("knife")).toBe("weapon_knife");
    expect(weaponIconFrame("hammer")).toBe("weapon_hammer");
  });

  it("returns null for fists (no weapon) and unmapped ids", () => {
    expect(weaponIconFrame(null)).toBeNull();
    expect(weaponIconFrame("torch")).toBeNull();
  });
});
