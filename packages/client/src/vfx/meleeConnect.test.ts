// Hand-derived tests for the whiff-vs-connect correlation logic (panel round 3b item 5).
import { describe, expect, it } from "vitest";
import {
  collectExpiredSwings,
  hitPlausiblyFromSwing,
  registerPendingSwing,
  resolveHitAgainstPending,
  WHIFF_TIMEOUT_MS,
  type PendingSwing,
} from "./meleeConnect.js";

function swing(overrides: Partial<PendingSwing> = {}): PendingSwing {
  return {
    attackerId: "a",
    worldX: 0,
    worldY: 0,
    z: 0,
    angleRad: 0, // facing +x
    depth: 0,
    startedAtMs: 1000,
    ...overrides,
  };
}

describe("hitPlausiblyFromSwing", () => {
  it("connects dead ahead, well inside range", () => {
    // distance 1 tile, dead on-axis (0 rad off) — comfortably inside 1.6 + 0.5 range and 0 <= arc
    expect(hitPlausiblyFromSwing(swing(), 1, 0)).toBe(true);
  });

  it("connects at the very edge of the range-slack allowance (2.1 tiles = 1.6 + 0.5)", () => {
    expect(hitPlausiblyFromSwing(swing(), 2.1, 0)).toBe(true);
  });

  it("misses just past the range-slack allowance", () => {
    expect(hitPlausiblyFromSwing(swing(), 2.2, 0)).toBe(false);
  });

  it("misses a hit directly behind the swing (180 degrees off-axis)", () => {
    expect(hitPlausiblyFromSwing(swing(), -1, 0)).toBe(false);
  });

  it("connects at 55 degrees off-axis (inside the arc-half-angle 45deg + 0.25rad~14.3deg slack ~59.3deg)", () => {
    const rad = (55 * Math.PI) / 180;
    expect(hitPlausiblyFromSwing(swing(), Math.cos(rad), Math.sin(rad))).toBe(true);
  });

  it("misses at 60 degrees off-axis (just past the ~59.3deg allowance)", () => {
    const rad = (60 * Math.PI) / 180;
    expect(hitPlausiblyFromSwing(swing(), Math.cos(rad), Math.sin(rad))).toBe(false);
  });

  it("treats a hit landing exactly on the swing's own origin as a connect (no direction to check)", () => {
    expect(hitPlausiblyFromSwing(swing(), 0, 0)).toBe(true);
  });

  it("respects the swing's own facing angle, not just +x", () => {
    // Facing straight up (+y, angleRad = PI/2); a hit at (0,1) is dead on-axis.
    expect(hitPlausiblyFromSwing(swing({ angleRad: Math.PI / 2 }), 0, 1)).toBe(true);
    // The same point is 90 degrees off-axis for a swing facing +x.
    expect(hitPlausiblyFromSwing(swing({ angleRad: 0 }), 0, 1)).toBe(false);
  });
});

describe("resolveHitAgainstPending", () => {
  it("removes the one pending swing a hit plausibly belongs to", () => {
    const pending = new Map<string, PendingSwing>();
    registerPendingSwing(pending, swing({ attackerId: "a" }));
    resolveHitAgainstPending(pending, 1, 0);
    expect(pending.has("a")).toBe(false);
  });

  it("leaves swings whose arc/range doesn't plausibly reach the hit", () => {
    const pending = new Map<string, PendingSwing>();
    registerPendingSwing(pending, swing({ attackerId: "a" }));
    resolveHitAgainstPending(pending, -5, 0); // far behind, out of range and arc
    expect(pending.has("a")).toBe(true);
  });

  it("prefers the most recently started matching swing when several overlap", () => {
    const pending = new Map<string, PendingSwing>();
    registerPendingSwing(pending, swing({ attackerId: "older", startedAtMs: 1000 }));
    registerPendingSwing(pending, swing({ attackerId: "newer", startedAtMs: 1050 }));
    resolveHitAgainstPending(pending, 1, 0);
    expect(pending.has("newer")).toBe(false);
    expect(pending.has("older")).toBe(true);
  });

  it("registering a second swing for the same attacker id replaces the first", () => {
    const pending = new Map<string, PendingSwing>();
    registerPendingSwing(pending, swing({ attackerId: "a", startedAtMs: 1000 }));
    registerPendingSwing(pending, swing({ attackerId: "a", startedAtMs: 2000 }));
    expect(pending.size).toBe(1);
    expect(pending.get("a")?.startedAtMs).toBe(2000);
  });
});

describe("collectExpiredSwings", () => {
  it("does not expire a swing one millisecond short of the timeout", () => {
    const pending = new Map<string, PendingSwing>([["a", swing({ startedAtMs: 1000 })]]);
    const expired = collectExpiredSwings(pending, 1000 + WHIFF_TIMEOUT_MS - 1);
    expect(expired).toHaveLength(0);
    expect(pending.has("a")).toBe(true);
  });

  it("expires (and removes) a swing exactly at the timeout", () => {
    const pending = new Map<string, PendingSwing>([["a", swing({ startedAtMs: 1000 })]]);
    const expired = collectExpiredSwings(pending, 1000 + WHIFF_TIMEOUT_MS);
    expect(expired.map((s) => s.attackerId)).toEqual(["a"]);
    expect(pending.has("a")).toBe(false);
  });

  it("only expires the swings that are actually due, leaving fresher ones pending", () => {
    const pending = new Map<string, PendingSwing>([
      ["old", swing({ attackerId: "old", startedAtMs: 1000 })],
      ["fresh", swing({ attackerId: "fresh", startedAtMs: 1000 + WHIFF_TIMEOUT_MS - 10 })],
    ]);
    const expired = collectExpiredSwings(pending, 1000 + WHIFF_TIMEOUT_MS);
    expect(expired.map((s) => s.attackerId)).toEqual(["old"]);
    expect(pending.has("fresh")).toBe(true);
  });
});
