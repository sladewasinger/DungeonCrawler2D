// ?scene=autotile-gallery harness: a fixed, labeled test map exercising every bitmask
// autotile case (single wall, straight runs, L/T/X junctions, blocks, a diagonal-only
// touch, the map edge) — rendered through the REAL terrain pipeline (buildChunkVisual,
// same debug tileset + autotile.ts every other scene uses) so this is the artifact
// the user reviews tile by tile, not a mockup.
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { buildChunkVisual } from "../../render/terrain/chunkVisual.js";
import { pixelTextStyle } from "../../ui/font.js";
import { EditableWorld, EDITOR_GRID_SIZE } from "../editor/EditableWorld.js";
import { GALLERY_FIXTURES, paintGallery, slotOrigin } from "./fixtures.js";

const LABEL_COLOR = "#ffd23d";
const LABEL_BG = "rgba(8, 8, 12, 0.82)";

export class AutotileGalleryScene extends Phaser.Scene {
  constructor() {
    super("autotile-gallery");
  }

  create(): void {
    const world = new EditableWorld();
    paintGallery(world);

    const worldPx = EDITOR_GRID_SIZE * SCREEN_TILE_PX;
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(worldPx / 2, worldPx / 2);
    this.cameras.main.setZoom(Math.min(this.scale.width, this.scale.height) / worldPx);
    this.cameras.main.setBackgroundColor("#14141c");

    buildChunkVisual(this, world, 0, 0);
    this.addLabels();
  }

  /** One small readout above each slot's top-left corner naming which case it is. */
  private addLabels(): void {
    GALLERY_FIXTURES.forEach((fixture, i) => {
      const { x, y } = slotOrigin(i);
      this.add
        .text(x * SCREEN_TILE_PX + 2, y * SCREEN_TILE_PX + 2, fixture.label, {
          ...pixelTextStyle(10, LABEL_COLOR),
        })
        .setOrigin(0, 0)
        .setDepth(1_000_000_000)
        .setPadding(3, 2, 3, 2)
        .setBackgroundColor(LABEL_BG);
    });
  }
}
