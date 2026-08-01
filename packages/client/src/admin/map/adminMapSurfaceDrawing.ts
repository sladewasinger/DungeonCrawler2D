import type { AdminMap, DebugFlags } from "@dc2d/engine";
import type { AdminMapCenter } from "./adminMapCamera.js";
import { renderAdminMap } from "./adminMapRenderer.js";

export interface AdminMapSurfaceDrawingInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap | null;
  readonly center: AdminMapCenter;
  readonly tileSize: number;
  readonly debugFlags: DebugFlags;
  readonly unavailableMessage: string;
}

export function drawAdminMapSurface(input: AdminMapSurfaceDrawingInput): void {
  renderAdminMap(input);
}
