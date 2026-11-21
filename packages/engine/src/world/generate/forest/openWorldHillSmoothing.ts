import { TILE } from "../../core/types.js";
import type { FloorBounds, FloorBuffers } from "../finiteFloorTypes.js";

const HILL_STEP = 0.25;
const MAX_SMOOTH_PASSES = 16;

export function smoothHillSlopes(buffers: FloorBuffers, bounds: FloorBounds, pinned: Uint8Array): void {
  for (let pass = 0; pass < MAX_SMOOTH_PASSES; pass++) {
    const forwardChanged = sweepForward(buffers, bounds, pinned);
    const backwardChanged = sweepBackward(buffers, bounds, pinned);
    if (!forwardChanged && !backwardChanged) break;
  }
}

function sweepForward(buffers: FloorBuffers, bounds: FloorBounds, pinned: Uint8Array): boolean {
  let changed = false;
  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      if (clampSlopeAt({ buffers, width: bounds.width, height: bounds.height, pinned, x, y })) changed = true;
    }
  }
  return changed;
}

function sweepBackward(buffers: FloorBuffers, bounds: FloorBounds, pinned: Uint8Array): boolean {
  let changed = false;
  for (let y = bounds.height - 1; y >= 0; y--) {
    for (let x = bounds.width - 1; x >= 0; x--) {
      if (clampSlopeAt({ buffers, width: bounds.width, height: bounds.height, pinned, x, y })) changed = true;
    }
  }
  return changed;
}

function clampSlopeAt(step: {
  readonly buffers: FloorBuffers;
  readonly width: number;
  readonly height: number;
  readonly pinned: Uint8Array;
  readonly x: number;
  readonly y: number;
}): boolean {
  const index = step.y * step.width + step.x;
  if (step.pinned[index] || step.buffers.tiles[index] !== TILE.Floor) return false;
  const original = step.buffers.height[index] ?? 0;
  let value = original;
  value = clampTowardNeighbor({ buffers: step.buffers, neighbor: index - 1, valid: step.x > 0, current: value });
  value = clampTowardNeighbor({ buffers: step.buffers, neighbor: index + 1, valid: step.x + 1 < step.width, current: value });
  value = clampTowardNeighbor({ buffers: step.buffers, neighbor: index - step.width, valid: step.y > 0, current: value });
  value = clampTowardNeighbor({ buffers: step.buffers, neighbor: index + step.width, valid: step.y + 1 < step.height, current: value });
  step.buffers.height[index] = value;
  return value !== original;
}

function clampTowardNeighbor(step: {
  readonly buffers: FloorBuffers;
  readonly neighbor: number;
  readonly valid: boolean;
  readonly current: number;
}): number {
  if (!step.valid || step.buffers.tiles[step.neighbor] !== TILE.Floor) return step.current;
  const target = step.buffers.height[step.neighbor] ?? 0;
  return step.current - target > HILL_STEP ? target + HILL_STEP : step.current;
}
