// Headless tests for the elevation-lift conversion.
import { describe, expect, it } from "vitest";
import { airborneHeightAboveGround, spriteLiftPx } from "./lift.js";

describe("spriteLiftPx", () => {
  it("lifts a grounded entity by its full height above z=0 — standing on a z1 platform reads as one tile up", () => {
    expect(spriteLiftPx(1)).toBe(48);
  });

  it("stays zero at ground level", () => {
    expect(spriteLiftPx(0)).toBe(0);
  });

  it("scales linearly with z, whether or not the trailing (ignored) args are supplied", () => {
    expect(spriteLiftPx(3)).toBe(3 * 48);
    expect(spriteLiftPx(3, 1, true)).toBe(3 * 48);
    expect(spriteLiftPx(3, 1, false)).toBe(3 * 48);
  });

  it("pushes a below-zero entity (a pit/chasm floor) down on screen instead of clamping to zero", () => {
    expect(spriteLiftPx(-1)).toBe(-48);
  });
});

describe("airborneHeightAboveGround", () => {
  it("is zero while grounded, no matter what z says", () => {
    expect(airborneHeightAboveGround(5, 0, false)).toBe(0);
  });

  it("is the height above local ground while airborne", () => {
    expect(airborneHeightAboveGround(3, 1, true)).toBe(2);
  });

  it("never goes negative when z sits at or below the local ground", () => {
    expect(airborneHeightAboveGround(1, 1, true)).toBe(0);
    expect(airborneHeightAboveGround(0, 1, true)).toBe(0);
  });
});
