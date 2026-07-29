import { describe, expect, it } from "vitest";
import { DEFAULT_HANDICAP, handicapForPlayer } from "./handicap.js";

describe("player handicap grants", () => {
  it("matches the temporary name grants case-insensitively and by substring", () => {
    expect(handicapForPlayer("JoSiAh Jr")).toBe(DEFAULT_HANDICAP);
    expect(handicapForPlayer("little ELLIE")).toBe(DEFAULT_HANDICAP);
    expect(handicapForPlayer("regular crawler")).toBeUndefined();
  });

  it("supports an explicit grant independently of the player's name", () => {
    expect(handicapForPlayer("regular crawler", true)).toBe(DEFAULT_HANDICAP);
    expect(DEFAULT_HANDICAP.damageGivenMultiplier).toBe(3);
  });
});
