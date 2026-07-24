/** Covers the damage-triggered combat health-bar policy without renderer objects. */
import { describe, expect, it } from "vitest";
import { resolveHpBarVisibility } from "./hpBarVisibility.js";

describe("resolveHpBarVisibility", () => {
  it("keeps a freshly observed full-health combatant hidden", () => {
    expect(resolveHpBarVisibility(undefined, 30, 30, false)).toBe(false);
  });

  it("shows after a real damage edge", () => {
    expect(resolveHpBarVisibility(30, 24, 30, false)).toBe(true);
  });

  it("stays visible while injured after being revealed and hides at full health", () => {
    expect(resolveHpBarVisibility(24, 24, 30, true)).toBe(true);
    expect(resolveHpBarVisibility(24, 30, 30, true)).toBe(false);
  });

  it("does not treat the first injured sample as a damage event", () => {
    expect(resolveHpBarVisibility(undefined, 24, 30, false)).toBe(false);
  });

  it("hides dead combatants", () => {
    expect(resolveHpBarVisibility(5, 0, 30, true)).toBe(false);
  });
});
