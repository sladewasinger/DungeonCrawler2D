import {
  GUARD_COLLISION_RADIUS_TILES,
  MELEE_ARC_COS,
  MELEE_RANGE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { guardWedgeGeometry } from "./guardGeometry.js";

describe("guard wedge geometry", () => {
  it("restores the broad presentation radius without enlarging guard collision", () => {
    const geometry = guardWedgeGeometry(Math.PI / 2, 48);
    expect(geometry.radiusPx).toBe(MELEE_RANGE * 48);
    expect(MELEE_RANGE).toBeGreaterThan(GUARD_COLLISION_RADIUS_TILES);
    expect(geometry.endAngle - geometry.startAngle).toBeCloseTo(
      Math.acos(MELEE_ARC_COS) * 2,
    );
  });
});
