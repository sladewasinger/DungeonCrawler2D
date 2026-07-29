import Phaser from "phaser";
import type { TerrainQuadBatchRenderer } from "../batch/quadBatch.js";
import type { TerrainAtlasBatchRenderer } from "../batch/atlasBatch.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";

export interface TerrainRoot {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly batch: TerrainQuadBatchRenderer;
  readonly atlas: TerrainAtlasBatchRenderer;
  readonly props: Map<string, Phaser.GameObjects.Sprite>;
  planKey: string;
  orientation: ViewOrientation;
}
