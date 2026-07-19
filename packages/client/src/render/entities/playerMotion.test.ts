// Headless tests for inferring a remote player's visual anim state from position deltas.
import { describe, expect, it } from "vitest";
import { inferPlayerAnimState } from "./playerMotion.js";

describe("inferPlayerAnimState", () => {
  it("attack always wins, regardless of motion", () => {
    expect(inferPlayerAnimState(5, 5, 0.1, true)).toBe("attack");
    expect(inferPlayerAnimState(0, 0, 0.1, true)).toBe("attack");
  });

  it("is idle with no elapsed time to measure a delta over", () => {
    expect(inferPlayerAnimState(1, 1, 0, false)).toBe("idle");
  });

  it("is walk above the moving-speed threshold, idle below it", () => {
    expect(inferPlayerAnimState(2, 0, 0.5, false)).toBe("walk");
    expect(inferPlayerAnimState(0.01, 0, 0.5, false)).toBe("idle");
  });
});
