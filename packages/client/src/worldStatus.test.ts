import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { aimHeadingDegrees, biomeLabel } from "./worldStatus.js";

describe("2D world status", () => {
  it("reports mouse aim clockwise from world north", () => {
    const origin = { x: 10, y: 10 };
    expect(aimHeadingDegrees(origin, { x: 10, y: 0 })).toBe(0);
    expect(aimHeadingDegrees(origin, { x: 20, y: 10 })).toBe(90);
    expect(aimHeadingDegrees(origin, { x: 10, y: 20 })).toBe(180);
    expect(aimHeadingDegrees(origin, { x: 0, y: 10 })).toBe(270);
  });

  it("turns biome ids into player-facing names", () => {
    expect(biomeLabel(BIOME.OpenHalls)).toBe("Open Halls");
    expect(biomeLabel(BIOME.Pools)).toBe("Flooded Pools");
  });
});
