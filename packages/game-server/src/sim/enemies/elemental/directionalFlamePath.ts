import type { DirectionalFlameCell } from "../../state/enemyState.js";
import { ELEMENTAL_ENEMY_TUNING } from "./configuration/elementalEnemyTuning.js";

export interface DirectionalFlamePathInput {
  readonly source: { readonly x: number; readonly y: number };
  readonly target: { readonly x: number; readonly y: number };
  readonly facing?: { readonly x: number; readonly y: number };
}

/** Builds the bounded, target-aligned tile sequence used for flame and debug. */
export function directionalFlamePath(
  input: DirectionalFlamePathInput,
): readonly DirectionalFlameCell[] {
  const source = flameTile(input.source);
  const target = flameTile(input.target);
  const endpoint = flameEndpoint(input);
  const cells = mergeFlamePaths(
    gridPath(source, target),
    gridPath(target, flameTile(endpoint)),
  );
  return cells.filter((cell) => cellIntersectsFlameRange(input.source, cell));
}

function flameEndpoint(input: DirectionalFlamePathInput): {
  readonly x: number;
  readonly y: number;
} {
  const direction = flameDirection(input);
  const distance = ELEMENTAL_ENEMY_TUNING.directionalFlame.maximumRangeTiles;
  return {
    x: input.source.x + direction.x * distance,
    y: input.source.y + direction.y * distance,
  };
}

function flameDirection(input: DirectionalFlamePathInput): {
  readonly x: number;
  readonly y: number;
} {
  const dx = input.target.x - input.source.x;
  const dy = input.target.y - input.source.y;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 0) return { x: dx / magnitude, y: dy / magnitude };
  return normalizedFacing(input.facing);
}

function normalizedFacing(
  facing: DirectionalFlamePathInput["facing"],
): { readonly x: number; readonly y: number } {
  const x = facing?.x ?? 0;
  const y = facing?.y ?? 1;
  const magnitude = Math.hypot(x, y);
  return magnitude > 0 ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 1 };
}

function flameTile(point: { readonly x: number; readonly y: number }): DirectionalFlameCell {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

function mergeFlamePaths(
  first: readonly DirectionalFlameCell[],
  second: readonly DirectionalFlameCell[],
): readonly DirectionalFlameCell[] {
  const seen = new Set<string>();
  return [...first, ...second].filter((cell) => {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function gridPath(
  source: DirectionalFlameCell,
  target: DirectionalFlameCell,
): readonly DirectionalFlameCell[] {
  const cells: DirectionalFlameCell[] = [];
  let x = source.x;
  let y = source.y;
  const stepX = Math.sign(target.x - source.x);
  const stepY = Math.sign(target.y - source.y);
  const distanceX = Math.abs(target.x - source.x);
  const distanceY = Math.abs(target.y - source.y);
  let error = distanceX - distanceY;
  while (x !== target.x || y !== target.y) {
    const doubledError = error * 2;
    if (doubledError > -distanceY) {
      error -= distanceY;
      x += stepX;
    }
    if (doubledError < distanceX) {
      error += distanceX;
      y += stepY;
    }
    cells.push({ x, y });
  }
  return cells;
}

function cellIntersectsFlameRange(
  source: DirectionalFlamePathInput["source"],
  cell: DirectionalFlameCell,
): boolean {
  const closestX = clamp(source.x, cell.x, cell.x + 1);
  const closestY = clamp(source.y, cell.y, cell.y + 1);
  return Math.hypot(source.x - closestX, source.y - closestY) <=
    ELEMENTAL_ENEMY_TUNING.directionalFlame.maximumRangeTiles;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
