// Determinism is a tested invariant (docs/ENGINEERING_STANDARDS.md): this asserts
// seededHash/seededFloat are pure functions of their inputs, never ambient state.
import { describe, expect, it } from "vitest";
import { seededFloat, seededHash } from "./hash.js";

describe("seededHash", () => {
  it("is deterministic for the same seed and input", () => {
    expect(seededHash(1, 2)).toBe(seededHash(1, 2));
    expect(seededHash(42, 1337)).toBe(seededHash(42, 1337));
  });

  it("differs across distinct inputs for the same seed", () => {
    expect(seededHash(1, 2)).not.toBe(seededHash(1, 3));
  });

  it("differs across distinct seeds for the same input", () => {
    expect(seededHash(1, 2)).not.toBe(seededHash(9, 2));
  });

  it("always returns a non-negative 32-bit integer", () => {
    const value = seededHash(-5, -9999);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("seededFloat", () => {
  it("is deterministic and bounded to [0, 1)", () => {
    const value = seededFloat(42, 7);
    expect(value).toBe(seededFloat(42, 7));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
