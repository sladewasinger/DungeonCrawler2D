import type { EntitySnapshot } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import { worldToView, type Point } from "../../../view/transform/viewTransform.js";

export interface PresentationViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TerrainPresentationVisibility {
  isWorldPositionVisible(x: number, y: number): boolean;
}

export interface EntityPresentationVisibilityInput {
  readonly entity: Pick<EntitySnapshot, "id" | "x" | "y" | "z">;
  readonly viewport: PresentationViewport;
  readonly orientation: ViewOrientation;
  readonly marginTiles: number;
  readonly retainedIds?: ReadonlySet<string>;
  readonly enabled?: boolean;
  readonly terrainVisibility?: TerrainPresentationVisibility | undefined;
}

/**
 * Decides whether an entity needs a presentation interpolation sample. This is
 * deliberately independent of authoritative state, interaction queries, and
 * room visibility; callers can use those systems without this filter.
 */
export function shouldPresentEntity({
  entity,
  viewport,
  orientation,
  marginTiles,
  retainedIds,
  enabled = true,
  terrainVisibility,
}: EntityPresentationVisibilityInput): boolean {
  if (!enabled || retainedIds?.has(entity.id)) return true;
  if (terrainVisibility && !terrainVisibility.isWorldPositionVisible(
    entity.x,
    entity.y,
  )) return false;
  return isEntityInViewport({ entity, viewport, orientation, marginTiles });
}

export function isEntityInViewport({
  entity,
  viewport,
  orientation,
  marginTiles,
}: Omit<EntityPresentationVisibilityInput, "retainedIds" | "enabled">): boolean {
  const screen = projectedEntityPoint(entity, orientation);
  const marginPx = marginTiles * SCREEN_TILE_PX;
  return screen.x >= viewport.x - marginPx &&
    screen.x <= viewport.x + viewport.width + marginPx &&
    screen.y >= viewport.y - marginPx &&
    screen.y <= viewport.y + viewport.height + marginPx;
}

function projectedEntityPoint(
  entity: Pick<EntitySnapshot, "x" | "y" | "z">,
  orientation: ViewOrientation,
): Point {
  const view = worldToView({ x: entity.x, y: entity.y }, orientation);
  return {
    x: view.x * SCREEN_TILE_PX,
    y: view.y * SCREEN_TILE_PX - entity.z * SCREEN_TILE_PX,
  };
}
