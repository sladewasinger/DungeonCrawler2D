import { FLOOR_SEMANTIC, isProtectedRouteSurfaceWalkable, type FloorGenerationSnapshot } from "@dc2d/engine";
import type { GenerationPreviewProjection } from "./generationPreviewProjection.js";
import { generationPreviewFeatureMarkerPoint } from "./generationPreviewHover.js";

interface GenerationPreviewDrawingInput {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: FloorGenerationSnapshot;
  readonly projection: GenerationPreviewProjection;
  readonly screenPoint: (
    projection: GenerationPreviewProjection,
    x: number,
    y: number,
  ) => { readonly x: number; readonly y: number };
  readonly showRoutes: boolean;
}

export function drawGenerationPreviewDecorations(input: GenerationPreviewDrawingInput): void {
  drawConnectors(input);
  if (input.showRoutes) drawTopology(input);
  drawFeatures(input);
}

function drawTopology(input: GenerationPreviewDrawingInput): void {
  const edges = uniqueWalkableRouteEdges(input.snapshot);
  if (edges.length === 0) return;
  input.context.strokeStyle = "rgba(240, 82, 255, 0.75)";
  input.context.lineWidth = Math.max(1, input.projection.scale * 0.45);
  input.context.beginPath();
  for (const [from, to] of edges) {
    const start = input.screenPoint(input.projection, from.x + 0.5, from.y + 0.5);
    const end = input.screenPoint(input.projection, to.x + 0.5, to.y + 0.5);
    input.context.moveTo(start.x, start.y);
    input.context.lineTo(end.x, end.y);
  }
  input.context.stroke();
}

function uniqueWalkableRouteEdges(snapshot: FloorGenerationSnapshot): RouteEdge[] {
  const edges = new Map<string, RouteEdge>();
  for (const route of snapshot.routes) {
    for (let index = 1; index < route.length; index++) {
      admitRouteEdge({ snapshot, from: route[index - 1], to: route[index], edges });
    }
  }
  return [...edges.values()];
}

type RoutePoint = { readonly x: number; readonly y: number };
type RouteEdge = readonly [RoutePoint, RoutePoint];

function admitRouteEdge(input: {
  readonly snapshot: FloorGenerationSnapshot;
  readonly from: RoutePoint | undefined;
  readonly to: RoutePoint | undefined;
  readonly edges: Map<string, RouteEdge>;
}): void {
  const { snapshot, from, to, edges } = input;
  if (!from || !to || !routeCellWalkable(snapshot, from) || !routeCellWalkable(snapshot, to)) return;
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 1) return;
  const fromKey = `${from.x},${from.y}`;
  const toKey = `${to.x},${to.y}`;
  edges.set(fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`, [from, to]);
}

function drawConnectors(input: GenerationPreviewDrawingInput): void {
  input.context.fillStyle = "#3fe0d0";
  const radius = input.projection.scale * 0.4;
  for (const connector of input.snapshot.connectors) {
    if (!routeCellWalkable(input.snapshot, connector)) continue;
    const screen = input.screenPoint(input.projection, connector.x + 0.5, connector.y + 0.5);
    input.context.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2);
  }
}

function routeCellWalkable(
  snapshot: FloorGenerationSnapshot,
  point: { readonly x: number; readonly y: number },
): boolean {
  if (!pointInsideSnapshot(snapshot, point)) return false;
  const index = (point.y - snapshot.bounds.minY) * snapshot.bounds.width + point.x - snapshot.bounds.minX;
  if (snapshot.stageId === "final-validated") return finalRouteCellWalkable(snapshot, index);
  return (snapshot.semantic[index] ?? FLOOR_SEMANTIC.Solid) > FLOOR_SEMANTIC.Solid;
}

function pointInsideSnapshot(snapshot: FloorGenerationSnapshot, point: RoutePoint): boolean {
  const { bounds } = snapshot;
  return point.x >= bounds.minX && point.x <= bounds.maxX
    && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function finalRouteCellWalkable(snapshot: FloorGenerationSnapshot, index: number): boolean {
  if (![snapshot.tiles, snapshot.terrain, snapshot.features, snapshot.protectedCells].every(Boolean)) return false;
  if (snapshot.surfaceValidation?.status !== "validated") return false;
  if (snapshot.surfaceValidation.failures.length > 0) return false;
  return isProtectedRouteSurfaceWalkable(snapshot, index);
}

function drawFeatures(input: GenerationPreviewDrawingInput): void {
  for (const feature of input.snapshot.featureStamps) {
    input.context.fillStyle = featureColor(feature.kind);
    const point = generationPreviewFeatureMarkerPoint(feature);
    const screen = input.screenPoint(input.projection, point.x + 0.5, point.y + 0.5);
    const radius = Math.max(1, input.projection.scale * 1.5);
    input.context.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2);
  }
}

export function drawGenerationPreviewCursor(input: {
  readonly context: CanvasRenderingContext2D;
  readonly projection: GenerationPreviewProjection;
  readonly cell?: { readonly x: number; readonly y: number } | null;
  readonly screenPoint: GenerationPreviewDrawingInput["screenPoint"];
}): void {
  if (!input.cell) return;
  const point = input.screenPoint(input.projection, input.cell.x + 0.5, input.cell.y + 0.5);
  input.context.fillStyle = "#ffffff";
  input.context.fillRect(Math.floor(point.x), Math.floor(point.y), 2, 2);
}

function featureColor(kind: string): string {
  const colors: Record<string, string> = {
    "spawn-exterior": "#74d69b", "safe-room": "#7fc8ff", "up-stair": "#d8e6ff",
    "down-stair": "#b99cff", "mini-boss-arena": "#f09a67", "boss-arena": "#ef5d6f",
  };
  return colors[kind] ?? "#f1c76a";
}
