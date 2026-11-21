import { hash2D } from "../../core/rng.js";
import { insideBounds, isCarved, localIndex } from "./finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, FloorPoint, NormalizedFloorGenerationConfig } from "./finiteFloorTypes.js";

export function mazeDirections(seed: number, point: FloorPoint): FloorPoint[] {
  const choices = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].map((direction) => ({ direction, roll: hash2D(seed, point.x + direction.x, point.y + direction.y) }));
  for (let index = 1; index < choices.length; index++) insertChoice(choices, index);
  return choices.map(({ direction }) => direction);
}

function insertChoice(choices: Array<{ direction: FloorPoint; roll: number }>, index: number): void {
  const current = choices[index];
  if (!current) return;
  let insert = index;
  while (insert > 0) {
    const previous = choices[insert - 1];
    if (!previous || previous.roll <= current.roll) break;
    choices[insert] = previous;
    insert--;
  }
  choices[insert] = current;
}

export function deterministicCorridorWidth(input: {
  readonly config: NormalizedFloorGenerationConfig;
  readonly seed: number;
  readonly start: FloorPoint;
  readonly end: FloorPoint;
}): number {
  const { ordinaryCorridorWidthMin: min, ordinaryCorridorWidthMax: max } = input.config;
  return min + hash2D(input.seed, input.start.x + input.end.x, input.start.y + input.end.y) % (max - min + 1);
}

export function corridorCells(input: {
  readonly start: FloorPoint;
  readonly end: FloorPoint;
  readonly direction: FloorPoint;
  readonly width: number;
}): FloorPoint[] {
  const side = { x: -input.direction.y, y: input.direction.x };
  const lowOffset = -Math.floor((input.width - 1) / 2);
  const cells: FloorPoint[] = [];
  const length = Math.abs(input.end.x - input.start.x) + Math.abs(input.end.y - input.start.y);
  for (let distance = 0; distance <= length; distance++) {
    for (let offset = lowOffset; offset < lowOffset + input.width; offset++) {
      cells.push({
        x: input.start.x + input.direction.x * distance + side.x * offset,
        y: input.start.y + input.direction.y * distance + side.y * offset,
      });
    }
  }
  return cells;
}

export function insideMaze(bounds: FloorBounds, point: FloorPoint): boolean {
  return insideBounds({ bounds, ...point })
    && point.x > bounds.minX && point.x < bounds.maxX
    && point.y > bounds.minY && point.y < bounds.maxY;
}

export function mazeCellTouchesAnotherRegion(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly regionId: number }, point: FloorPoint): boolean {
  return CARDINAL.some((direction) => {
    const neighbor = { x: point.x + direction.x, y: point.y + direction.y };
    if (!insideBounds({ bounds: input.bounds, ...neighbor })) return false;
    const index = localIndex({ bounds: input.bounds, ...neighbor });
    return isCarved(input.buffers, index) && (input.buffers.roomWallIds[index] ?? -1) < 0
      && (input.buffers.region[index] ?? 0) !== input.regionId;
  });
}

const CARDINAL = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
] as const;
