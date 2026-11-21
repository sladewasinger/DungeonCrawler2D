import { FLOOR_SEMANTIC, type FloorGenerationSnapshot, type GeneratedFeatureStamp } from "@dc2d/engine";

interface CellContext {
  readonly snapshot: FloorGenerationSnapshot;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly semantic: number;
}

export function generationPreviewCellDescription(snapshot: FloorGenerationSnapshot, x: number, y: number): string {
  const index = cellIndex(snapshot, x, y);
  if (index < 0) return "Outside the finite floor bounds.";
  const context = { snapshot, index, x, y, semantic: snapshot.semantic[index] ?? FLOOR_SEMANTIC.Solid };
  return featureDescription(context)
    ?? connectorDescription(context)
    ?? roomWallDescription(context)
    ?? roomDescription(context)
    ?? territoryDescription(context)
    ?? semanticDescription(context.semantic);
}

export function refreshGenerationPreviewHover(input: {
  readonly hover: HTMLElement | undefined;
  readonly snapshot: FloorGenerationSnapshot;
  readonly cell: { readonly x: number; readonly y: number } | null;
}): void {
  if (!input.hover) return;
  input.hover.textContent = input.cell
    ? generationPreviewCellDescription(input.snapshot, input.cell.x, input.cell.y)
    : "Hover a map cell for details.";
}

export function generationPreviewFeatureMarkerPoint(feature: GeneratedFeatureStamp): { readonly x: number; readonly y: number } {
  return feature.position ?? {
    x: (feature.bounds.x0 + feature.bounds.x1) / 2,
    y: (feature.bounds.y0 + feature.bounds.y1) / 2,
  };
}

function cellIndex(snapshot: FloorGenerationSnapshot, x: number, y: number): number {
  const { bounds } = snapshot;
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) return -1;
  return (y - bounds.minY) * bounds.width + x - bounds.minX;
}

function featureDescription(input: CellContext): string | null {
  const feature = featureAtCell(input);
  return feature ? `${featureLabel(feature.kind)} · cell ${input.x}, ${input.y}` : null;
}

function featureAtCell(input: CellContext): GeneratedFeatureStamp | undefined {
  const featureId = input.snapshot.featureIds[input.index] ?? -1;
  const indexed = featureId >= 0 ? input.snapshot.featureStamps[featureId] : undefined;
  return indexed ?? input.snapshot.featureStamps.find((feature) => markerCellMatches(feature, input.x, input.y));
}

function markerCellMatches(feature: GeneratedFeatureStamp, x: number, y: number): boolean {
  const point = generationPreviewFeatureMarkerPoint(feature);
  return Math.floor(point.x + 0.5) === x && Math.floor(point.y + 0.5) === y;
}

function connectorDescription(input: CellContext): string | null {
  if (input.snapshot.connectors.some(({ x, y }) => x === input.x && y === input.y)) return "Connector point";
  return input.snapshot.routes.some((route) => route.some(({ x, y }) => x === input.x && y === input.y))
    ? "Protected route debug overlay" : null;
}

function roomWallDescription(input: CellContext): string | null {
  const wall = (input.snapshot.roomWallIds[input.index] ?? -1) >= 0;
  return input.semantic === FLOOR_SEMANTIC.RoomWall || wall ? "Ordinary room wall envelope" : null;
}

function roomDescription(input: CellContext): string | null {
  const room = input.snapshot.rooms.some((rect) => input.x >= rect.x0 && input.x <= rect.x1 && input.y >= rect.y0 && input.y <= rect.y1);
  return input.semantic === FLOOR_SEMANTIC.Room || room ? "Ordinary room" : null;
}

function territoryDescription(input: CellContext): string | null {
  const territory = input.snapshot.territory[input.index] ?? 0;
  return territory > 0 ? `Territory structure · region ${territory}` : null;
}

function semanticDescription(semantic: number): string {
  if (semantic === FLOOR_SEMANTIC.Transition) return "Transition cell";
  if (semantic === FLOOR_SEMANTIC.Corridor) return "Corridor cell";
  return "Unoccupied floor";
}

function featureLabel(kind: string): string {
  const labels: Record<string, string> = {
    "spawn-exterior": "Spawn", "safe-room": "Safe room", "up-stair": "Stairs up",
    "down-stair": "Stairs down", "mini-boss-arena": "Mini-boss arena", "boss-arena": "Boss arena",
  };
  return labels[kind] ?? `Feature: ${kind}`;
}
