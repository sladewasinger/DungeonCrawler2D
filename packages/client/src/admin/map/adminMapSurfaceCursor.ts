import type { AdminMap } from "@dc2d/engine";
import {
  adminMapPointerCanvasPoint,
  type AdminMapCenter,
} from "./adminMapCamera.js";
import { deletableAdminEntityAt } from "./adminMapEntityHitTest.js";
import type { AdminSpawnSelection } from "./adminMapSurfaceTypes.js";

export interface AdminMapSurfaceCursorInput {
  readonly map: AdminMap | null;
  readonly center: AdminMapCenter;
  readonly canvas: HTMLCanvasElement;
  readonly tileSize: number;
  readonly interactionEnabled: boolean;
  readonly selection: AdminSpawnSelection;
  readonly pointerPanning: boolean;
  readonly event?: MouseEvent;
}

export function adminMapSurfaceCursor(input: AdminMapSurfaceCursorInput): string {
  if (input.pointerPanning) return "grabbing";
  const entity = input.event ? deletableAdminMapEntityAt(input) : null;
  if (entity && input.interactionEnabled) return "pointer";
  return canPlaceOnAdminMap(input) ? "crosshair" : "grab";
}

export function deletableAdminMapEntityAt(
  input: AdminMapSurfaceCursorInput,
): ReturnType<typeof deletableAdminEntityAt> {
  if (!input.map || !input.event) return null;
  return deletableAdminEntityAt({
    map: input.map,
    center: input.center,
    canvas: input.canvas,
    tileSize: input.tileSize,
    point: adminMapPointerCanvasPoint({ event: input.event, canvas: input.canvas }),
  });
}

export function canPlaceOnAdminMap(input: AdminMapSurfaceCursorInput): boolean {
  return input.interactionEnabled && input.selection.placementAllowed !== false &&
    input.map !== null && input.selection.defId.length > 0;
}
