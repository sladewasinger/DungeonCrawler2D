// Headless tests for the enemy-blood tint lookup.
import { describe, expect, it } from "vitest";
import { bloodTintFor } from "./bloodTint.js";

describe("bloodTintFor", () => {
  it("defaults players (no defId) to blood-red", () => {
    expect(bloodTintFor(undefined)).toBe(0xe04a4a);
  });

  it("defaults unmapped enemies to blood-red", () => {
    expect(bloodTintFor("skeleton")).toBe(0xe04a4a);
    expect(bloodTintFor("spitter")).toBe(0xe04a4a);
  });

  it("overrides the slime to poison-green ooze", () => {
    expect(bloodTintFor("slime")).toBe(0x7bd44a);
  });
});
