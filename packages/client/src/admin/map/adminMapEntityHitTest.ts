import type { AdminMap, AdminMapEntity } from "@dc2d/engine";
import {
  adminMapScreenPoint,
  type AdminMapCanvas,
  type AdminMapCenter,
  type AdminMapProjectionInput,
  type AdminMapScreenPoint,
} from "./adminMapCamera.js";

const ADMIN_DELETABLE_ENTITY_KINDS = new Set<AdminMapEntity["kind"]>([
  "enemy",
  "weapon",
]);
const ADMIN_MARKER_HIT_RADIUS = 10;
const ADMIN_MARKER_EDGE_GAP = 0.5;

export interface AdminMapEntityHitTestInput {
  readonly map: AdminMap;
  readonly center: AdminMapCenter;
  readonly canvas: AdminMapCanvas;
  readonly point: AdminMapScreenPoint;
  readonly tileSize?: number;
}

export function adminMapEntityScreenPoint(
  input: AdminMapProjectionInput,
): AdminMapScreenPoint {
  return adminMapScreenPoint(input);
}

export function deletableAdminEntityAt(
  input: AdminMapEntityHitTestInput,
): AdminMapEntity | null {
  return [...input.map.entities]
    .reverse()
    .find((entity) => isDeletableMarker(entity, input)) ?? null;
}

function isDeletableMarker(
  entity: AdminMapEntity,
  input: AdminMapEntityHitTestInput,
): boolean {
  return ADMIN_DELETABLE_ENTITY_KINDS.has(entity.kind) &&
    pointHitsEntity(
      input.point,
      adminMapEntityScreenPoint({
        world: entity,
        center: input.center,
        canvas: input.canvas,
        ...(input.tileSize === undefined ? {} : { tileSize: input.tileSize }),
      }),
      markerHitRadius(input.tileSize),
    );
}

function pointHitsEntity(
  point: AdminMapScreenPoint,
  entityPoint: AdminMapScreenPoint,
  radius: number,
): boolean {
  return Math.hypot(point.x - entityPoint.x, point.y - entityPoint.y) <= radius;
}

function markerHitRadius(tileSize?: number): number {
  if (tileSize === undefined) return ADMIN_MARKER_HIT_RADIUS;
  return Math.min(ADMIN_MARKER_HIT_RADIUS, tileSize / 2 - ADMIN_MARKER_EDGE_GAP);
}
