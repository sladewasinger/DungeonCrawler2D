import { describe, expect, it } from "vitest";
import { hammerStrikeTransform } from "./hammerStrike.js";

describe("hammer overhead strike", () => {
  it("moves from behind the wielder, over their head, then onto the ground", () => {
    const start = transform(0);
    const apex = transform(0.5);
    const impact = transform(1);

    expect(start.x).toBeLessThan(100);
    expect(start.behindWielder).toBe(true);
    expect(apex.y).toBeLessThan(start.y);
    expect(apex.scale).toBeGreaterThan(1);
    expect(impact.x).toBeGreaterThan(100);
    expect(impact.y).toBeGreaterThan(start.y);
    expect(impact.behindWielder).toBe(false);
  });

  it("clamps animation progress without changing combat direction", () => {
    expect(transform(-1)).toEqual(transform(0));
    expect(transform(2)).toEqual(transform(1));
  });
});

function transform(progress: number) {
  return hammerStrikeTransform({
    screenX: 100,
    screenY: 80,
    attackAngleRad: 0,
    progress,
    tilePx: 48,
  });
}
