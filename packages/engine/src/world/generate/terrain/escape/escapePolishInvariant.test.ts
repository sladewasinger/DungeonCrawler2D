import { describe, expect, it } from "vitest";
import { WALL_RISE } from "../../../../core/constants.js";
import { hashString } from "../../../../core/rng.js";
import { World } from "../../../core/world.js";
import { DISTRICT_TILE_SPAN } from "../../layout/district.js";

const SIZE = DISTRICT_TILE_SPAN;
const HEIGHT_EPSILON = 0.01;
const OFFSETS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

describe("generated terrain escape invariant", () => {
  it("leaves no finite floor pocket unable to return to a district edge", () => {
    const world = new World(hashString("dev-world-1"), 1, {
      features: { voidTerrain: false },
    });
    const reached = reverseFloodFromDistrictEdge(world);
    const trapped = walkableIndices(world).filter((index) => !reached.has(index));

    expect(trapped.slice(0, 20).map(pointAt)).toEqual([]);
  });
});

function reverseFloodFromDistrictEdge(world: World): Set<number> {
  const queue = walkableIndices(world).filter((index) =>
    crossesDistrictSeam(world, index)
  );
  const reached = new Set(queue);
  for (let head = 0; head < queue.length; head++) {
    const destination = queue[head];
    if (destination === undefined) continue;
    visitPredecessors({ world, reached, queue }, destination);
  }
  return reached;
}

function crossesDistrictSeam(world: World, index: number): boolean {
  const point = pointAt(index);
  return outsideNeighbors(point).some((outside) =>
    world.isWalkable(outside.x, outside.y) &&
    groundAt(world, outside) - groundAt(world, point) <=
      WALL_RISE + HEIGHT_EPSILON
  );
}

function outsideNeighbors(
  point: { readonly x: number; readonly y: number },
): Array<{ x: number; y: number }> {
  const outside: Array<{ x: number; y: number }> = [];
  if (point.x === 0) outside.push({ x: -1, y: point.y });
  if (point.y === 0) outside.push({ x: point.x, y: -1 });
  if (point.x === SIZE - 1) outside.push({ x: SIZE, y: point.y });
  if (point.y === SIZE - 1) outside.push({ x: point.x, y: SIZE });
  return outside;
}

function visitPredecessors(
  search: { world: World; reached: Set<number>; queue: number[] },
  destination: number,
): void {
  for (const source of neighbors(destination)) {
    if (search.reached.has(source) ||
        !canReach(search.world, source, destination)) continue;
    search.reached.add(source);
    search.queue.push(source);
  }
}

function walkableIndices(world: World): number[] {
  const indices: number[] = [];
  for (let index = 0; index < SIZE * SIZE; index++) {
    const point = pointAt(index);
    if (world.isWalkable(point.x, point.y)) indices.push(index);
  }
  return indices;
}

function canReach(world: World, source: number, destination: number): boolean {
  const from = pointAt(source);
  const to = pointAt(destination);
  if (!world.isWalkable(from.x, from.y) ||
      !world.isWalkable(to.x, to.y)) return false;
  return groundAt(world, to) - groundAt(world, from) <=
    WALL_RISE + HEIGHT_EPSILON;
}

function groundAt(world: World, point: { x: number; y: number }): number {
  return world.groundAt(point.x + 0.5, point.y + 0.5);
}

function neighbors(index: number): number[] {
  const point = pointAt(index);
  return OFFSETS.flatMap(([dx, dy]) => {
    const x = point.x + dx;
    const y = point.y + dy;
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE
      ? [y * SIZE + x]
      : [];
  });
}

function pointAt(index: number): { x: number; y: number } {
  const x = index % SIZE;
  return { x, y: Math.floor(index / SIZE) };
}
