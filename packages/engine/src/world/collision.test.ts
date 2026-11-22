import { describe, expect, it } from "vitest";
import { WorldChunkCache, resolveMovement } from "./collision.js";
import { GroundKind } from "./types.js";

describe("collision", () => {
  it("slides around deep water and cliff ledges while allowing stair traversal", () => {
    const cache = new WorldChunkCache(1337);
    const open = resolveMovement({
      cache,
      x: 0.5,
      y: 0.5,
      dx: 0.25,
      dy: 0,
      radius: 0.28,
      elevation: 0,
    });
    expect(open.x).toBeGreaterThan(0.5);
    expect(open.elevation).toBe(0);

    // Highland wall at (-8, -8) is elevation 1; stepping into it from south without stairs stops.
    const blockedWall = resolveMovement({
      cache,
      x: -7.5,
      y: -6.5,
      dx: 0,
      dy: -0.6,
      radius: 0.25,
      elevation: 0,
    });
    expect(blockedWall.y).toBe(-6.5);

    // Stepping onto stairs at (-9.5, -5.5) -> (-9.5, -6.5) -> (-9.5, -7.5) succeeds.
    const onStairs = resolveMovement({
      cache,
      x: -9.5,
      y: -5.5,
      dx: 0,
      dy: -0.9,
      radius: 0.25,
      elevation: 0,
    });
    expect(onStairs.y).toBeCloseTo(-6.4, 4);
    const climber = resolveMovement({
      cache,
      x: -9.5,
      y: -6.5,
      dx: 0,
      dy: -0.9,
      radius: 0.25,
      elevation: 0,
    });
    expect(climber.elevation).toBe(1);

    // Approaching south cliff edge (wy = -7 at y = -6.0) stops cleanly at footDepth (0.14).
    const atSouthBase = resolveMovement({ cache, x: -7.5, y: -5.8, dx: 0, dy: -0.5, radius: 0.28, elevation: 0 });
    expect(atSouthBase.y).toBe(-5.8);

    // Approaching north cliff back edge (wy = -13 at y = -13.0) allows standing close behind the rim.
    const atNorthBack = resolveMovement({ cache, x: -7.5, y: -13.2, dx: 0, dy: 0.04, radius: 0.28, elevation: 0 });
    expect(atNorthBack.y).toBeCloseTo(-13.16, 3);

    // Walking grounded south off the raised cliff edge stays blocked.
    const groundedEdge = resolveMovement({ cache, x: -7.5, y: -6.5, dx: 0, dy: 0.9, radius: 0.28, elevation: 1 });
    expect(groundedEdge.elevation).toBe(1);
    expect(groundedEdge.elevationDrop).toBe(0);
    expect(groundedEdge.y).toBe(-6.5);

    // Airborne jumping south off the raised cliff clears the rim and drops to elevation 0.
    const jumpedOff = resolveMovement({ cache, x: -7.5, y: -6.5, dx: 0, dy: 0.9, radius: 0.28, elevation: 1, airborne: true });
    expect(jumpedOff.y).toBeCloseTo(-5.6, 3);
    expect(jumpedOff.elevation).toBe(0);
    expect(jumpedOff.elevationDrop).toBe(1);

    // Airborne movement cannot jump up into a cliff wall from below.
    const blockedAirWall = resolveMovement({ cache, x: -7.5, y: -5.8, dx: 0, dy: -0.5, radius: 0.28, elevation: 0, airborne: true });
    expect(blockedAirWall.y).toBe(-5.8);
    expect(blockedAirWall.elevation).toBe(0);
  });

  it("slows movement in shallow water without blocking", () => {
    const cache = new WorldChunkCache(1337);
    let shallowCoord: { x: number; y: number } | null = null;
    for (let x = 1; x < 30; x++) {
      if (cache.tileAt(x, 0).ground === GroundKind.ShallowWater) {
        shallowCoord = { x: x + 0.5, y: 0.5 };
        break;
      }
    }
    expect(shallowCoord).not.toBeNull();
    if (!shallowCoord) return;
    const res = resolveMovement({
      cache,
      x: shallowCoord.x,
      y: shallowCoord.y,
      dx: 0.05,
      dy: 0,
      radius: 0.2,
      elevation: 0,
    });
    expect(res.inWater).toBe(true);
    expect(res.speedMultiplier).toBe(0.65);
  });
});
