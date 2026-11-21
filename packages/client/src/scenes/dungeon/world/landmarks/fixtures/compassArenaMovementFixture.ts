import { CHUNK_SIZE, type World } from "@dc2d/engine";
import { nearestMiniBossArena } from "../miniBossCompassSearch.js";

interface Point {
  readonly x: number;
  readonly y: number;
}

interface TargetedPoint {
  readonly point: Point;
  readonly target: Point;
}

export interface CompassArenaMovementFixture {
  readonly before: Point;
  readonly after: Point;
  readonly beforeTarget: Point;
  readonly afterTarget: Point;
}

export function compassArenaMovementFixture(
  world: World,
  centers: readonly Readonly<Point>[],
): CompassArenaMovementFixture {
  const movement = boundaryCandidateChunks(centers)
    .map((chunk) => retargetingMovementInChunk(world, chunk))
    .find((candidate) => candidate !== null);
  if (!movement) throw new Error("test world has no within-chunk arena boundary");
  return movement;
}

function retargetingMovementInChunk(
  world: World,
  chunk: { readonly cx: number; readonly cy: number },
): CompassArenaMovementFixture | null {
  const observations = chunkPoints(chunk).flatMap((point) => {
    const target = nearestMiniBossArena({ world, ...point });
    return target ? [{ point, target }] : [];
  });
  const before = observations[0];
  const after = before && observations.find(({ target }) =>
    !samePosition(before.target, target));
  return before && after ? movement(before, after) : null;
}

function movement(
  before: TargetedPoint,
  after: TargetedPoint,
): CompassArenaMovementFixture {
  return {
    before: before.point,
    after: after.point,
    beforeTarget: before.target,
    afterTarget: after.target,
  };
}

function boundaryCandidateChunks(
  centers: readonly Readonly<Point>[],
): readonly { readonly cx: number; readonly cy: number }[] {
  const chunks = centers.flatMap((left, index) => centers.slice(index + 1)
    .flatMap((right) => neighboringChunks({
      cx: Math.floor((left.x + right.x) / 2 / CHUNK_SIZE),
      cy: Math.floor((left.y + right.y) / 2 / CHUNK_SIZE),
    })));
  return [...new Map(chunks.map((chunk) => [`${chunk.cx},${chunk.cy}`, chunk])).values()];
}

function neighboringChunks(center: { readonly cx: number; readonly cy: number }) {
  return [-1, 0, 1].flatMap((dy) => [-1, 0, 1]
    .map((dx) => ({ cx: center.cx + dx, cy: center.cy + dy })));
}

function chunkPoints(chunk: { readonly cx: number; readonly cy: number }): Point[] {
  return Array.from({ length: CHUNK_SIZE }, (_, y) =>
    Array.from({ length: CHUNK_SIZE }, (_, x) => ({
      x: chunk.cx * CHUNK_SIZE + x + 0.5,
      y: chunk.cy * CHUNK_SIZE + y + 0.5,
    }))).flat();
}

function samePosition(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}
