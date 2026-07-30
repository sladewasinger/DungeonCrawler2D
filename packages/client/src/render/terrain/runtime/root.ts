import Phaser from "phaser";
import {
  createTerrainQuadBatchRenderer,
  type TerrainQuadBatchRenderer,
} from "../batch/quadBatch.js";
import {
  TerrainAtlasBatchRenderer,
} from "../batch/atlasBatch.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { TerrainDeviceProfile } from "../streaming/terrainDeviceProfile.js";
import { TERRAIN_DEPTH } from "./renderSupport.js";

export interface TerrainRoot {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly batch: TerrainQuadBatchRenderer;
  readonly atlas: TerrainAtlasBatchRenderer;
  readonly props: Map<string, Phaser.GameObjects.Sprite>;
  planKey: string;
  orientation: ViewOrientation;
}

export function createTerrainRoot(
  scene: Phaser.Scene,
  orientation: ViewOrientation,
  profile: TerrainDeviceProfile,
): TerrainRoot {
  const batch = createTerrainQuadBatchRenderer(scene);
  return {
    graphics: batch.graphics.setDepth(TERRAIN_DEPTH).setVisible(false),
    batch,
    atlas: new TerrainAtlasBatchRenderer(scene, profile.visuals),
    props: new Map(),
    planKey: "",
    orientation,
  };
}

export function destroyTerrainRoot(root: TerrainRoot): void {
  root.graphics.destroy();
  root.atlas.destroy();
  for (const prop of root.props.values()) prop.destroy();
  root.props.clear();
}
