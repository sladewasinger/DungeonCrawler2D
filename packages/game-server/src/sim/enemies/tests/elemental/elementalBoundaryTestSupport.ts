import { TILE, type TileType } from "@dc2d/engine";
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
  const { cell, boundary } = request;
  const blockedTile = boundaryTile(boundary);
  const originalSurfaceTileAt = sim.world.surfaceTileAt.bind(sim.world);
  vi.spyOn(sim.world, "surfaceTileAt").mockImplementation((cellX, cellY) =>
    Math.floor(cellX) === cell.x && Math.floor(cellY) === cell.y
      ? blockedTile
      : originalSurfaceTileAt(cellX, cellY)
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

function boundaryTile(boundary: BoundaryKind): TileType {
  if (boundary === "walkable") return TILE.CraftingTable;
  if (boundary === "bedrock") return TILE.Bedrock;
  return TILE.Void;
}
