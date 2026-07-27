/** Verifies that enemy AI is live by default and can still be frozen explicitly. */
import { describe, expect, it } from "vitest";
import { enemiesAreFrozen } from "./runtimeOptions.js";

describe("enemiesAreFrozen", () => {
  it("enables enemy AI when the flag is absent or disabled", () => {
    expect(enemiesAreFrozen(undefined)).toBe(false);
    expect(enemiesAreFrozen("0")).toBe(false);
  });

  it("freezes enemy AI only when explicitly enabled", () => {
    expect(enemiesAreFrozen("1")).toBe(true);
  });
});
