import { LEVEL, STEP_UP, World, type BodyState } from "@dc2d/engine";

export const SPAWN_X = -12;
export const SPAWN_Y = -26;

export function sandboxWorld(): World {
  return new World(7, 0, LEVEL.Sandbox);
}

export function closeBody(a: BodyState, b: BodyState, eps = 1e-9): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
}

function isEastWallApproach(world: World, tileX: number, tileY: number): boolean {
  if (!world.isWalkable(tileX, tileY) || !world.isWalkable(tileX + 1, tileY)) return false;
  return world.heightAt(tileX + 1, tileY) - world.heightAt(tileX, tileY) > STEP_UP;
}

function wallApproachAt(world: World, tileX: number, tileY: number): { x: number; y: number; z: number } | null {
  if (!isEastWallApproach(world, tileX, tileY)) return null;
  const x = tileX + 0.5;
  const y = tileY + 0.5;
  return { x, y, z: world.groundAt(x, y) };
}

export function findEastWallApproach(world: World): { x: number; y: number; z: number } {
  for (const { tileX, tileY } of nearbyTiles()) {
      const approach = wallApproachAt(world, tileX, tileY);
      if (approach) return approach;
  }
  throw new Error("seed fixture has no east-facing wall approach");
}

function* nearbyTiles(): Generator<{ tileX: number; tileY: number }> {
  for (let tileY = -30; tileY <= 30; tileY++) {
    for (let tileX = -30; tileX <= 30; tileX++) yield { tileX, tileY };
  }
}
