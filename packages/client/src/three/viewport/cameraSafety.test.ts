import { describe, expect, it } from "vitest";
import { CAMERA_WALL_CLEARANCE, safeCameraPosition } from "./cameraSafety.js";

const world = (walls: readonly string[]) => ({
  isWalkable: (x: number, z: number) => !walls.includes(`${x},${z}`),
});

describe("safeCameraPosition", () => {
  it("slides along a wall when smoothing cuts a blocked corner", () => {
    const result = safeCameraPosition({
      world: world(["1,1"]),
      current: { x: 0.5, z: 0.5 },
      desired: { x: 1.2, z: 1.2 },
    });
    expect(result).toEqual({ x: 1.2, z: 0.5 });
  });

  it("keeps the last safe position when both axes enter walls", () => {
    const result = safeCameraPosition({
      world: world(["1,0", "0,1", "1,1"]),
      current: { x: 0.5, z: 0.5 },
      desired: { x: 1.2, z: 1.2 },
    });
    expect(result).toEqual({ x: 0.5, z: 0.5 });
  });

  it("keeps the near plane clear of an adjacent solid tile", () => {
    const result = safeCameraPosition({
      world: world(["1,0"]),
      current: { x: 0.5, z: 0.5 },
      desired: { x: 0.99, z: 0.5 },
    });
    expect(result.x).toBeCloseTo(1 - CAMERA_WALL_CLEARANCE);
  });

  it("does not clamp across a walkable tile boundary", () => {
    const result = safeCameraPosition({
      world: world([]),
      current: { x: 0.5, z: 0.5 },
      desired: { x: 1.02, z: 0.5 },
    });
    expect(result).toEqual({ x: 1.02, z: 0.5 });
  });
});
