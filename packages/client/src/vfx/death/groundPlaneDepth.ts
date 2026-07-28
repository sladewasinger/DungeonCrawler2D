import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForEntity, depthForGroundEffect } from "../../render/entities/presentation/depthSort.js";

export type GroundedVisualLayer =
  | "blood"
  | "corpse"
  | "corpseFragment"
  | "item";

/** Screen-space Y foreshortening for circular marks lying on a floor viewed at ~45°. */
export const GROUND_DECAL_VERTICAL_SCALE = Math.SQRT1_2;

export interface GroundedVisualPlacement {
  readonly groundedRow: number;
  readonly projectedScreenY: number;
  readonly depth: number;
  readonly groundHeight: number;
  readonly layer: GroundedVisualLayer;
}

export interface GroundedVisualInput {
  readonly rawScreenY: number;
  readonly groundHeight: number;
  readonly layer: GroundedVisualLayer;
  readonly scatterScreenY?: number;
}

export interface GroundPlanePoint {
  readonly x: number;
  readonly y: number;
}

export interface GroundPlaneSegmentPiece {
  readonly row: number;
  readonly start: GroundPlanePoint;
  readonly end: GroundPlanePoint;
}

/** Returns the painter row occupied by an unprojected screen-space Y coordinate. */
export function groundEffectRow(screenY: number): number {
  return Math.floor(screenY / SCREEN_TILE_PX);
}

/** Keeps a local vertical offset and its footprint inside the origin's ground row. */
export function containedGroundOffset(rawScreenY: number, offsetY: number, halfHeight: number): number {
  return containedOffsetInRow({ rawScreenY, offsetY, halfHeight, row: groundEffectRow(rawScreenY) });
}

/** Keeps a local offset and its footprint inside the row containing that offset. */
export function containedGroundOffsetInOwnRow(rawScreenY: number, offsetY: number, halfHeight: number): number {
  return containedOffsetInRow({ rawScreenY, offsetY, halfHeight, row: groundEffectRow(rawScreenY + offsetY) });
}

function containedOffsetInRow({ rawScreenY, offsetY, halfHeight, row }: {
  readonly rawScreenY: number;
  readonly offsetY: number;
  readonly halfHeight: number;
  readonly row: number;
}): number {
  const rowTop = row * SCREEN_TILE_PX;
  const minimum = rowTop + halfHeight;
  const maximum = rowTop + SCREEN_TILE_PX - halfHeight;
  return Math.min(maximum, Math.max(minimum, rawScreenY + offsetY)) - rawScreenY;
}

/** Splits a local line wherever its unprojected screen-space Y crosses a ground row. */
export function splitGroundSegmentByRow({
  rawScreenY,
  start,
  end,
}: {
  readonly rawScreenY: number;
  readonly start: GroundPlanePoint;
  readonly end: GroundPlanePoint;
}): GroundPlaneSegmentPiece[] {
  const deltaY = end.y - start.y;
  if (Math.abs(deltaY) < 1e-6) return [{ row: groundEffectRow(rawScreenY + start.y), start, end }];
  const firstRow = groundEffectRow(rawScreenY + Math.min(start.y, end.y));
  const lastRow = groundEffectRow(rawScreenY + Math.max(start.y, end.y));
  const pieces: GroundPlaneSegmentPiece[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const bounds = rowSegmentParameters({ rawScreenY, start, deltaY, row });
    if (bounds === undefined) continue;
    pieces.push({ row, start: interpolatePoint(start, end, bounds.start), end: interpolatePoint(start, end, bounds.end) });
  }
  return pieces;
}

function rowSegmentParameters({
  rawScreenY,
  start,
  deltaY,
  row,
}: {
  readonly rawScreenY: number;
  readonly start: GroundPlanePoint;
  readonly deltaY: number;
  readonly row: number;
}): { readonly start: number; readonly end: number } | undefined {
  const rowTop = row * SCREEN_TILE_PX - rawScreenY;
  const rowBottom = rowTop + SCREEN_TILE_PX;
  const parameters = deltaY > 0
    ? { start: (rowTop - start.y) / deltaY, end: (rowBottom - start.y) / deltaY }
    : { start: (rowBottom - start.y) / deltaY, end: (rowTop - start.y) / deltaY };
  const startParameter = Math.max(0, parameters.start);
  const endParameter = Math.min(1, parameters.end);
  return startParameter <= endParameter ? { start: startParameter, end: endParameter } : undefined;
}

function interpolatePoint(start: GroundPlanePoint, end: GroundPlanePoint, amount: number): GroundPlanePoint {
  return { x: start.x + (end.x - start.x) * amount, y: start.y + (end.y - start.y) * amount };
}

/**
 * One inspectable contract for ground-anchored visuals.
 *
 * Elevation shifts the drawn position onto the projected terrain surface. Blood,
 * corpses, and fragments use the row-local ground-effect band so their geometry
 * stays behind every entity standing on that floor. Items retain entity ordering.
 */
export function groundedVisualPlacement({
  rawScreenY,
  groundHeight,
  layer,
  scatterScreenY = 0,
}: GroundedVisualInput): GroundedVisualPlacement {
  const groundedScreenY = rawScreenY + scatterScreenY;
  const groundedRow = groundedScreenY / SCREEN_TILE_PX;
  return {
    groundedRow,
    projectedScreenY: groundedScreenY - groundHeight * SCREEN_TILE_PX,
    depth: layer === "item"
      ? depthForEntity(groundedRow)
      : depthForGroundEffect(groundedRow),
    groundHeight,
    layer,
  };
}
