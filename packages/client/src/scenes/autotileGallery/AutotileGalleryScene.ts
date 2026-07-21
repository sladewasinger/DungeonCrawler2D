// ?scene=autotile-gallery harness: a fixed, labeled test map exercising every bitmask
// autotile case (single wall, straight runs, L/T/X junctions, blocks, a diagonal-only
// touch, the map edge) — rendered through the REAL terrain pipeline (buildChunkVisual,
// same debug tileset + autotile.ts every other scene uses) so this is the artifact
// the user reviews tile by tile, not a mockup.
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { buildChunkVisual } from "../../render/terrain/chunkVisual.js";
import { islandChunkCoords, islandViewCentroid } from "../../render/terrain/islandChunk.js";
import { getViewOrientation } from "../../render/view/viewState.js";
import { worldTileToView } from "../../render/view/viewTransform.js";
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
    const orientation = getViewOrientation();

    const worldPx = EDITOR_GRID_SIZE * SCREEN_TILE_PX;
    // The camera must center on the island's ROTATED centroid, not its fixed world
    // pixel center — see render/terrain/islandChunk.ts's doc comment for why the island
    // itself moves.
    const viewCentroid = islandViewCentroid(orientation, EDITOR_GRID_SIZE);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(viewCentroid.x * SCREEN_TILE_PX, viewCentroid.y * SCREEN_TILE_PX);
    this.cameras.main.setZoom(Math.min(this.scale.width, this.scale.height) / worldPx);
    this.cameras.main.setBackgroundColor("#14141c");

    // Reads the dev-only ?vo= startup orientation (see boot/PreloadScene.ts) so this
    // gallery — the connectivity regression artifact — can be captured at all 4
    // orientations; the game itself never changes this mid-session yet (next lane).
    // Exactly one chunk at orientation 0 (pixel-lock anchor); islandChunkCoords may
    // return up to 4 at the other 3 — the island's rotated bounding box can straddle a
    // CHUNK_SIZE=32-aligned boundary since gridSize=20 doesn't evenly divide it.
    for (const { cx, cy } of islandChunkCoords(orientation, EDITOR_GRID_SIZE)) {
      buildChunkVisual(this, world, cx, cy, orientation);
    }
    this.addLabels(orientation);
  }

  /** One small readout above each slot's top-left corner naming which case it is — placed
   * at its fixture's rotated screen position so it still names the right shape. */
  private addLabels(orientation: ReturnType<typeof getViewOrientation>): void {
    GALLERY_FIXTURES.forEach((fixture, i) => {
      const { x, y } = slotOrigin(i);
      const view = worldTileToView({ x, y }, orientation);
      this.add
        .text(view.x * SCREEN_TILE_PX + 2, view.y * SCREEN_TILE_PX + 2, fixture.label, {
          ...pixelTextStyle(10, LABEL_COLOR),
        })
        .setOrigin(0, 0)
        .setDepth(1_000_000_000)
        .setPadding(3, 2, 3, 2)
        .setBackgroundColor(LABEL_BG);
    });
  }
}
