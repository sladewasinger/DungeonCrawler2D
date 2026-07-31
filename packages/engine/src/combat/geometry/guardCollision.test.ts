import { describe, expect, it } from "vitest";
import {
  GUARD_COLLISION_RADIUS_TILES,
  firstGuardSweepContact,
  guardVolume,
  circleTouchesGuard,
} from "./guardCollision.js";

const guard = guardVolume({
  center: { x: 0, y: 0 },
  facing: { x: 1, y: 0 },
});

describe("guard collision volume", () => {
  it("expands the short shield volume by the moving enemy radius", () => {
    const enemyRadius = 0.25;
    const collisionEdge = GUARD_COLLISION_RADIUS_TILES + enemyRadius;
    expect(circleTouchesGuard({ center: { x: collisionEdge, y: 0 }, radius: enemyRadius }, guard)).toBe(true);
    expect(circleTouchesGuard({ center: { x: collisionEdge + 0.01, y: 0 }, radius: enemyRadius }, guard)).toBe(false);
  });

  it("does not block a same-distance body outside the shield arc", () => {
    expect(circleTouchesGuard({ center: { x: 0, y: 0.9 }, radius: 0.25 }, guard)).toBe(false);
  });

  it("finds contact when a fast body crosses the shield within one simulation step", () => {
    const contact = firstGuardSweepContact({
      guard,
      start: { x: 1.4, y: 0 },
      end: { x: 0.2, y: 0 },
      radius: 0.25,
    });
    expect(contact).toBeGreaterThan(0);
    expect(contact).toBeLessThan(1);
  });
});
