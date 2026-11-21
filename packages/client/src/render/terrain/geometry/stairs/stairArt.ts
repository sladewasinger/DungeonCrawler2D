import { entryClimbDir, TILE } from "@dc2d/engine";
import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import type { Point } from "../../../view/transform/viewTransform.js";
import { worldToView } from "../../../view/transform/viewTransform.js";
import type { TerrainFeatureQuad, TerrainQuadVertices, TerrainSource } from "../terrainPlannerModel.js";

interface StairArtRequest {
  readonly source: TerrainSource;
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly orientation: ViewOrientation;
  readonly batches: { readonly features: TerrainFeatureQuad[] };
}

interface StairStepGeometry {
  readonly axis: Point;
  readonly low: number;
  readonly high: number;
  readonly step: number;
  readonly count: number;
}

export function appendStairTreads(request: StairArtRequest): boolean {
  const direction = stairDirection(request);
  if (direction === null) return false;
  const count = Math.max(1, Math.floor(request.source.stairTreadCount ?? 1));
  const axis = STAIR_DIRECTIONS[direction];
  if (!axis) return false;
  const high = request.source.heightAt(request.worldTile.x + axis.x, request.worldTile.y + axis.y);
  const low = request.source.heightAt(request.worldTile.x - axis.x, request.worldTile.y - axis.y);
  for (let step = 0; step < count; step++) appendStairStep(request, { axis, low, high, step, count });
  return true;
}

function stairDirection(request: StairArtRequest): number | null {
  return entryClimbDir({
    tileAt: (x, y) => request.source.featureAt?.(x, y) === "stairs" ? TILE.Stairs : TILE.Floor,
    heightAt: request.source.heightAt,
  }, request.worldTile.x, request.worldTile.y);
}

function appendStairStep(request: StairArtRequest, geometry: StairStepGeometry): void {
  const bottom = lerp(geometry.low, geometry.high, geometry.step / geometry.count);
  const top = lerp(geometry.low, geometry.high, (geometry.step + 1) / geometry.count);
  const range = { from: geometry.step / geometry.count, to: (geometry.step + 1) / geometry.count };
  request.batches.features.push(stairQuad(request, top, stairTopVertices(request, { axis: geometry.axis, range, height: top })));
  request.batches.features.push({
    ...stairQuad(request, top, stairRiserVertices(request, { axis: geometry.axis, position: range.from, bottom, top })),
    wallMounted: true,
  });
}

function stairQuad(request: StairArtRequest, height: number, vertices: TerrainQuadVertices): TerrainFeatureQuad {
  return { kind: "feature", feature: "stairs", worldTile: request.worldTile, viewTile: request.viewTile, height, vertices };
}

function stairTopVertices(request: StairArtRequest, geometry: { readonly axis: Point; readonly range: { readonly from: number; readonly to: number }; readonly height: number }): TerrainQuadVertices {
  const side = { x: -geometry.axis.y, y: geometry.axis.x };
  return stairVertices(request, [
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.range.from, across: -0.5, z: geometry.height }),
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.range.from, across: 0.5, z: geometry.height }),
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.range.to, across: 0.5, z: geometry.height }),
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.range.to, across: -0.5, z: geometry.height }),
  ]);
}

function stairRiserVertices(request: StairArtRequest, geometry: { readonly axis: Point; readonly position: number; readonly bottom: number; readonly top: number }): TerrainQuadVertices {
  const side = { x: -geometry.axis.y, y: geometry.axis.x };
  return stairVertices(request, [
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.position, across: -0.5, z: geometry.top }),
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.position, across: 0.5, z: geometry.top }),
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.position, across: 0.5, z: geometry.bottom }),
    stairPoint(request.worldTile, { axis: geometry.axis, side, along: geometry.position, across: -0.5, z: geometry.bottom }),
  ]);
}

function stairPoint(tile: Point, geometry: { readonly axis: Point; readonly side: Point; readonly along: number; readonly across: number; readonly z: number }) {
  const center = { x: tile.x + 0.5, y: tile.y + 0.5 };
  return {
    x: center.x + geometry.axis.x * (geometry.along - 0.5) + geometry.side.x * geometry.across,
    y: center.y + geometry.axis.y * (geometry.along - 0.5) + geometry.side.y * geometry.across,
    z: geometry.z,
  };
}

function stairVertices(request: StairArtRequest, points: readonly ReturnType<typeof stairPoint>[]): TerrainQuadVertices {
  return points.map(({ x, y, z }) => ({ ...worldToView({ x, y }, request.orientation), z })) as unknown as TerrainQuadVertices;
}

function lerp(from: number, to: number, t: number): number { return from + (to - from) * t; }
const STAIR_DIRECTIONS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const;
