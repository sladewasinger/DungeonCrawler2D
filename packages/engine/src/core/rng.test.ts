// Determinism is a tested invariant (docs/ENGINEERING_STANDARDS.md): every primitive
// here must be a pure function of its inputs, never ambient state. Includes the
// determinism assertions folded in from the removed scaffold hash.ts (hash2D/hash2DFloat
// are this engine's single seeded-hash source of truth).
import { describe, expect, it } from "vitest";
import { Rng, hash2D, hash2DFloat, hashString, mixSeeds } from "./rng.js";

describe("rng", () => {
  it("hashString is deterministic and spreads", () => {
    expect(hashString("dev-world-1")).toBe(hashString("dev-world-1"));
    expect(hashString("dev-world-1")).not.toBe(hashString("dev-world-2"));
  });

  it("hash2D is deterministic per (seed, x, y) including negatives", () => {
    expect(hash2D(42, -7, 13)).toBe(hash2D(42, -7, 13));
    expect(hash2D(42, -7, 13)).not.toBe(hash2D(42, 13, -7));
    expect(hash2D(42, 0, 0)).not.toBe(hash2D(43, 0, 0));
  });

  it("hash2D always returns a non-negative uint32", () => {
    const value = hash2D(-5, -9999, 42);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });

  it("hash2DFloat is deterministic and bounded to [0, 1)", () => {
    const value = hash2DFloat(42, 7, 3);
    expect(value).toBe(hash2DFloat(42, 7, 3));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("mixSeeds is order-sensitive", () => {
    expect(mixSeeds(1, 2, 3)).not.toBe(mixSeeds(3, 2, 1));
  });

  it("Rng produces an identical sequence for identical seeds", () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("Rng.int stays within bounds", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});
