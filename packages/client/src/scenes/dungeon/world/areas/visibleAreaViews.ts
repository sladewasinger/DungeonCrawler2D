import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { Connection } from "../../../../net/connection/connection.js";
import type { WorldView } from "@dc2d/engine";
import type { DungeonSceneState } from "../../orchestration/state.js";
import { buildAreaTileViewsInto } from "./areaViews.js";
import type {
  TerrainPresentationVisibility,
} from "../../../../render/entities/presentation/visibility/entityPresentationVisibility.js";

interface VisibleAreaViewInput {
  readonly connection: Connection;
  readonly world: Pick<WorldView, "groundAt">;
  readonly state: DungeonSceneState;
  readonly view: Phaser.Geom.Rectangle;
  readonly constrainedPresentation?: boolean;
  readonly terrainVisibility?: TerrainPresentationVisibility | undefined;
}

/** One tile preloads edge effects without restoring the desktop two-tile window. */
export const CONSTRAINED_VFX_MARGIN_PX = SCREEN_TILE_PX;
const STANDARD_AREA_VIEW_MARGIN_PX = 2 * SCREEN_TILE_PX;

export function visibleAreaMarginPx(constrainedPresentation: boolean): number {
  return constrainedPresentation
    ? CONSTRAINED_VFX_MARGIN_PX
    : STANDARD_AREA_VIEW_MARGIN_PX;
}

export function visibleAreaViews(input: VisibleAreaViewInput) {
  const { connection, state, view, world } = input;
  const marginPx = visibleAreaMarginPx(input.constrainedPresentation === true);
  return buildAreaTileViewsInto({
    areaTiles: connection.areaTiles,
    areaLayers: connection.areaTileLayers,
    groundAt: (x, y) => world.groundAt(x, y),
    bounds: view,
    marginPx,
    views: state.areaViews,
    records: state.areaViewRecords,
    terrainVisibility: input.terrainVisibility,
  });
}
