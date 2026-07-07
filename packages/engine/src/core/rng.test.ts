import { describe, expect, it } from "vitest";
import { Rng, hash2D, hashString, mixSeeds } from "./rng";

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
