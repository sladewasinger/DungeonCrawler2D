// Headless tests for status-tint color selection, flicker bounds, and tint compositing.
import { describe, expect, it } from "vitest";
import { compositeStatusTint, statusTintFor, type StatusTint } from "./statusTint.js";

/** Narrows a possibly-null tint for callers that already know their fx list should produce one. */
function assertTint(tint: StatusTint | null): StatusTint {
  if (!tint) throw new Error("expected a status tint");
  return tint;
}

describe("statusTintFor", () => {
  it("is null with no burning/poisoned status", () => {
    expect(statusTintFor(["bleeding"], 0)).toBeNull();
    expect(statusTintFor([], 0)).toBeNull();
  });

  it("prefers burning over poisoned when both are active", () => {
    expect(assertTint(statusTintFor(["poisoned", "on-fire"], 0)).color).toBe(0xff9e3d);
  });

  it("picks poisoned's green when only poisoned is active", () => {
    expect(assertTint(statusTintFor(["poisoned"], 0)).color).toBe(0x7bd44a);
  });

  it("flickers alpha within bounds and varies over time", () => {
    const samples = [0, 65, 130, 195].map((ms) => assertTint(statusTintFor(["on-fire"], ms)).alpha);
    for (const alpha of samples) {
      expect(alpha).toBeGreaterThanOrEqual(0.35);
      expect(alpha).toBeLessThanOrEqual(0.85);
    }
    expect(new Set(samples).size).toBeGreaterThan(1);
  });
});

describe("compositeStatusTint", () => {
  it("is neutral white at alpha 0 and the pure color at alpha 1", () => {
    expect(compositeStatusTint({ color: 0xff9e3d, alpha: 0 })).toBe(0xffffff);
    expect(compositeStatusTint({ color: 0xff9e3d, alpha: 1 })).toBe(0xff9e3d);
  });
});
