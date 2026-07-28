import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  TERRAIN_HEIGHT_EPSILON,
  TERRAIN_KINDS,
  type TerrainAOMask,
  type TerrainAOQuad,
  type TerrainQuadVertices,
  type TerrainSource,
  type TerrainSouthFaceQuad,
} from "./terrainPlannerModel.js";

interface WallAmbientOcclusionRequest {
  readonly source: TerrainSource;
  readonly orientation: ViewOrientation;
  readonly face: TerrainSouthFaceQuad;
}

interface WallSide {
  readonly offsetX: -1 | 1;
  readonly mask: TerrainAOMask;
}

const WEST_WALL: WallSide = {
  offsetX: -1,
  mask: { north: false, south: false, east: false, west: true, nw: false, ne: false, sw: false, se: false },
};
const EAST_WALL: WallSide = {
  offsetX: 1,
  mask: { north: false, south: false, east: true, west: false, nw: false, ne: false, sw: false, se: false },
};
const WALL_SIDES = [WEST_WALL, EAST_WALL] as const;

export function appendWallAmbientOcclusion(
  request: WallAmbientOcclusionRequest,
  target: TerrainAOQuad[],
): void {
  for (const side of WALL_SIDES) {
    const topHeight = innerCornerTop(request, side.offsetX);
    if (topHeight !== null) target.push(wallAmbientOcclusionQuad(request, side, topHeight));
  }
}

function wallAmbientOcclusionQuad(
  request: WallAmbientOcclusionRequest,
  side: WallSide,
  topHeight: number,
): TerrainAOQuad {
  return {
    kind: "ao", surface: "wall", height: request.face.topHeight,
    worldTile: request.face.worldTile, viewTile: request.face.viewTile,
    mask: side.mask,
    vertices: wallQuad(request.face.viewTile, topHeight, request.face.bottomHeight),
  };
}

function innerCornerTop(
  request: WallAmbientOcclusionRequest,
  offsetX: number,
): number | null {
  const sideHeight = floorHeightAt(request, offsetView(request.face.viewTile, offsetX, 0));
  const diagonalHeight = floorHeightAt(request, offsetView(request.face.viewTile, offsetX, 1));
  if (sideHeight === null || diagonalHeight === null) return null;
  const topHeight = Math.min(request.face.topHeight, sideHeight, diagonalHeight);
  return topHeight - request.face.bottomHeight > TERRAIN_HEIGHT_EPSILON ? topHeight : null;
}

function wallQuad(viewTile: Point, topHeight: number, bottomHeight: number): TerrainQuadVertices {
  const edgeY = viewTile.y + 1;
  return [
    { x: viewTile.x, y: edgeY, z: topHeight }, { x: viewTile.x + 1, y: edgeY, z: topHeight },
    { x: viewTile.x + 1, y: edgeY, z: bottomHeight }, { x: viewTile.x, y: edgeY, z: bottomHeight },
  ];
}

function offsetView(tile: Point, x: number, y: number): Point {
  return { x: tile.x + x, y: tile.y + y };
}

function floorHeightAt(request: WallAmbientOcclusionRequest, viewTile: Point): number | null {
  const worldTile = viewTileToWorld(viewTile, request.orientation);
  if (request.source.terrainAt(worldTile.x, worldTile.y) !== TERRAIN_KINDS.Floor) return null;
  const height = request.source.heightAt(worldTile.x, worldTile.y);
  return Number.isFinite(height) ? height : null;
}
