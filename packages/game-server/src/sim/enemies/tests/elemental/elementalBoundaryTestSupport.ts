import { vi } from "vitest";
import type { SimState } from "../../../state/state.js";

export type BoundaryKind = "walkable" | "bedrock" | "void";

interface SurfaceCell {
  readonly x: number;
  readonly y: number;
}

interface SurfaceBoundary {
  readonly cell: SurfaceCell;
  readonly boundary: BoundaryKind;
}

export function blockSurfaceCell(
  sim: SimState,
  request: SurfaceBoundary,
): void {
  const { cell } = request;
  const originalWalkable = sim.world.isWalkable.bind(sim.world);
  vi.spyOn(sim.world, "isWalkable").mockImplementation((cellX, cellY) =>
    cellIsBlocked({ cell, cellX, cellY })
      ? false
      : originalWalkable(cellX, cellY),
  );
}

interface TerrainCrest {
  readonly cell: SurfaceCell;
  readonly height: number;
}

export function mockTerrainCrest(
  sim: SimState,
  request: TerrainCrest,
): void {
  const { cell, height } = request;
  const originalGroundAt = sim.world.groundAt.bind(sim.world);
  vi.spyOn(sim.world, "groundAt").mockImplementation((cellX, cellY) =>
    Math.floor(cellX) === cell.x && Math.floor(cellY) === cell.y
      ? height
      : originalGroundAt(cellX, cellY)
  );
}

interface RaisedPlatform {
  readonly startX: number;
  readonly height: number;
}

export function mockRaisedPlatform(
  sim: SimState,
  request: RaisedPlatform,
): void {
  vi.spyOn(sim.world, "groundAt").mockImplementation((x) =>
    Math.floor(x) >= request.startX ? request.height : 0
  );
}

interface BoundaryCellCheck {
  readonly cell: SurfaceCell;
  readonly cellX: number;
  readonly cellY: number;
}

function cellIsBlocked(input: BoundaryCellCheck): boolean {
  return Math.floor(input.cellX) === input.cell.x &&
    Math.floor(input.cellY) === input.cell.y;
}
