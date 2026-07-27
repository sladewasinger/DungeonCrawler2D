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

export interface FindWalkableInput {
  world: World;
  origin: Pick<WalkablePoint, "x" | "z">;
  offset?: number;
}

export const findWalkable = ({ world, origin, offset = 0 }: FindWalkableInput): WalkablePoint => {
  for (let radius = 0; radius < 40; radius += 1) {
    const point = findAtRadius({
      world,
      origin: { x: origin.x + offset, z: origin.z },
      radius,
    });
    if (point) return point;
  }
  return { x: 0.5, z: 0.5, height: 0 };
};

interface FindAtRadiusInput extends FindWalkableInput {
  radius: number;
}

const findAtRadius = ({ world, origin, radius }: FindAtRadiusInput): WalkablePoint | null => {
  return radiusOffsets(radius)
    .map((offset) => candidate(world, origin.x + offset.x, origin.z + offset.z))
    .find(isWalkablePoint) ?? null;
};

const radiusOffsets = (radius: number): WalkableOffset[] =>
  integerRange(-radius, radius)
    .flatMap((z) => integerRange(-radius, radius).map((x) => ({ x, z })))
    .filter((point) => Math.max(Math.abs(point.x), Math.abs(point.z)) === radius);

const integerRange = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const isWalkablePoint = (point: WalkablePoint | null): point is WalkablePoint => point !== null;

interface WalkableOffset {
  x: number;
  z: number;
}
