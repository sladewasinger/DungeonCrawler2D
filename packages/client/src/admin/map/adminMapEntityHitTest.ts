import type { AdminMap, AdminMapEntity } from "@dc2d/engine";
import {
  adminMapScreenPoint,
  type AdminMapCanvas,
  type AdminMapCenter,
  type AdminMapScreenPoint,
} from "./adminMapCamera.js";

const ADMIN_DELETABLE_ENTITY_KINDS = new Set<AdminMapEntity["kind"]>([
  "enemy",
  "weapon",
]);
const ADMIN_MARKER_HIT_RADIUS = 10;

export interface AdminMapEntityHitTestInput {
  readonly map: AdminMap;
  readonly center: AdminMapCenter;
  readonly canvas: AdminMapCanvas;
  readonly point: AdminMapScreenPoint;
}

export function adminMapEntityScreenPoint(
  entity: Pick<AdminMapEntity, "x" | "y">,
  center: AdminMapCenter,
  canvas: AdminMapCanvas,
): AdminMapScreenPoint {
  return adminMapScreenPoint(entity, center, canvas);
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
    pointHitsEntity(input.point, adminMapEntityScreenPoint(entity, input.center, input.canvas));
}

function pointHitsEntity(
  point: AdminMapScreenPoint,
  entityPoint: AdminMapScreenPoint,
): boolean {
  return Math.hypot(point.x - entityPoint.x, point.y - entityPoint.y) <= ADMIN_MARKER_HIT_RADIUS;
}
