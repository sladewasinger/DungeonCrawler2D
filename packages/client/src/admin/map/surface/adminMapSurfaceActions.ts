import { adminMapPointerWorldPoint } from "../adminMapCamera.js";
import {
  canPlaceOnAdminMap,
  deletableAdminMapEntityAt,
  type AdminMapSurfaceCursorInput,
} from "../adminMapSurfaceCursor.js";
import type { AdminSpawnSelection } from "../adminMapSurfaceTypes.js";

interface AdminMapSurfacePlacementAction {
  readonly cursor: AdminMapSurfaceCursorInput;
  readonly onSpawn: (x: number, y: number, selection: AdminSpawnSelection) => void;
}

interface AdminMapSurfaceRemovalAction {
  readonly cursor: AdminMapSurfaceCursorInput;
  readonly onDespawn: (entityId: string) => void;
}

export function placeAdminMapEntity(input: AdminMapSurfacePlacementAction): void {
  const { cursor } = input;
  if (!cursor.event || !canPlaceOnAdminMap(cursor)) return;
  const point = adminMapPointerWorldPoint({
    event: cursor.event,
    canvas: cursor.canvas,
    center: cursor.center,
    tileSize: cursor.tileSize,
  });
  input.onSpawn(point.x, point.y, cursor.selection);
}

export function removeAdminMapEntity(input: AdminMapSurfaceRemovalAction): void {
  const { cursor } = input;
  const entity = deletableAdminMapEntityAt(cursor);
  if (!cursor.interactionEnabled || !entity) return;
  input.onDespawn(entity.id);
}
