import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { Connection } from "../../../../net/connection/connection.js";
import type { WorldView } from "@dc2d/engine";
import type { DungeonSceneState } from "../../orchestration/state.js";
import { buildAreaTileViewsInto } from "./areaViews.js";

interface VisibleAreaViewInput {
  readonly connection: Connection;
  readonly world: Pick<WorldView, "groundAt">;
  readonly state: DungeonSceneState;
  readonly view: Phaser.Geom.Rectangle;
}

export function visibleAreaViews(input: VisibleAreaViewInput) {
  const { connection, state, view, world } = input;
  return buildAreaTileViewsInto({
    areaTiles: connection.areaTiles,
    areaLayers: connection.areaTileLayers,
    groundAt: (x, y) => world.groundAt(x, y),
    bounds: view,
    marginPx: 2 * SCREEN_TILE_PX,
    views: state.areaViews,
    records: state.areaViewRecords,
  });
}
