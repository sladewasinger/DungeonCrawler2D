/** Covers the damage-triggered combat health-bar policy without renderer objects. */
import { describe, expect, it } from "vitest";
import { resolveHpBarVisibility } from "./hpBarVisibility.js";

describe("resolveHpBarVisibility", () => {
  it("keeps a freshly observed full-health combatant hidden", () => {
    expect(resolveHpBarVisibility({ previousHp: undefined, hp: 30, maxHp: 30, revealed: false })).toBe(false);
  });

  it("shows after a real damage edge", () => {
    expect(resolveHpBarVisibility({ previousHp: 30, hp: 24, maxHp: 30, revealed: false })).toBe(true);
  });

  it("stays visible while injured after being revealed and hides at full health", () => {
    expect(resolveHpBarVisibility({ previousHp: 24, hp: 24, maxHp: 30, revealed: true })).toBe(true);
    expect(resolveHpBarVisibility({ previousHp: 24, hp: 30, maxHp: 30, revealed: true })).toBe(false);
  });

  it("does not treat the first injured sample as a damage event", () => {
    expect(resolveHpBarVisibility({ previousHp: undefined, hp: 24, maxHp: 30, revealed: false })).toBe(false);
  });

  it("hides dead combatants", () => {
    expect(resolveHpBarVisibility({ previousHp: 5, hp: 0, maxHp: 30, revealed: true })).toBe(false);
  });
});
