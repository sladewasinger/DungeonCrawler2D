/** Owns deterministic walkable-point lookup for prototype player and entity placement. */
import type { World } from "@dc2d/engine";

export interface WalkablePoint {
  x: number;
  z: number;
  height: number;
}

const candidate = (world: World, x: number, z: number): WalkablePoint | null => {
  if (!world.isWalkable(x, z)) return null;
  return { x: x + 0.5, z: z + 0.5, height: world.groundAt(x + 0.5, z + 0.5) };
};

export const findWalkable = (world: World, originX: number, originZ: number, offset = 0): WalkablePoint => {
  for (let radius = 0; radius < 40; radius += 1) {
    const point = findAtRadius(world, originX + offset, originZ, radius);
    if (point) return point;
  }
  return { x: 0.5, z: 0.5, height: 0 };
};

const findAtRadius = (world: World, originX: number, originZ: number, radius: number): WalkablePoint | null => {
  for (let z = -radius; z <= radius; z += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== radius) continue;
      const point = candidate(world, originX + x, originZ + z);
      if (point) return point;
    }
  }
  return null;
};
