import { describe, expect, it } from "vitest";
import { tailChaseOffset } from "./dinos/doux.js";

describe("dino tail chase motion", () => {
  it("returns to the center after one complete loop", () => {
    expect(tailChaseOffset(0)).toEqual(tailChaseOffset(820));
  });

  it("moves around the pet instead of only rotating the sprite", () => {
    const offset = tailChaseOffset(205);
    expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);
    expect(offset.angle).not.toBe(0);
  });
});
