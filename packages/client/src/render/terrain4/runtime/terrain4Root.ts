import Phaser from "phaser";
import type { Phaser4TerrainQuadBatchRenderer } from "../batch/phaser4QuadBatch.js";
import type { Phaser4TerrainAtlasBatchRenderer } from "../batch/phaser4AtlasBatch.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";

export interface Terrain4Root {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly batch: Phaser4TerrainQuadBatchRenderer;
  readonly atlas: Phaser4TerrainAtlasBatchRenderer;
  readonly props: Map<string, Phaser.GameObjects.Sprite>;
  planKey: string;
  orientation: ViewOrientation;
}
