// The editor's right panel: renders the painted world through the REAL terrain
// pipeline (buildChunkVisual — same faces/rims/corners the game draws), with an
// optional collision overlay proving the pixels and the blocking rules agree.
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { buildChunkVisual, destroyChunkVisual, type ChunkVisual } from "../../render/terrain/chunkVisual.js";
import { EDITOR_GRID_SIZE } from "./EditableWorld.js";
import type { EditorStore } from "./editorStore.js";

const OVERLAY_DEPTH = 1_000_000_000;
const BLOCKED_TINT = 0xe04a4a;
const RAISED_TINT = 0x7bd44a;

export class EditorScene extends Phaser.Scene {
  private store!: EditorStore;
  private visual: ChunkVisual | undefined;
  private overlay: Phaser.GameObjects.Container | undefined;

  constructor() {
    super("editor");
  }

  init(data: { store: EditorStore }): void {
    this.store = data.store;
  }

  create(): void {
    const worldPx = EDITOR_GRID_SIZE * SCREEN_TILE_PX;
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(worldPx / 2, worldPx / 2);
    this.cameras.main.setZoom(Math.min(this.scale.width, this.scale.height) / worldPx);
    this.store.onChange(() => this.rebuild());
    this.rebuild();
  }

  private rebuild(): void {
    if (this.visual) destroyChunkVisual(this.visual);
    this.overlay?.destroy(true);
    this.overlay = undefined;
    // The 20x20 grid lives inside chunk (0,0); out-of-grid cells read as chasm
    // void, so the island frames itself.
    this.visual = buildChunkVisual(this, this.store.world, 0, 0);
    if (this.store.showCollision) this.drawCollisionOverlay();
  }

  /** Red = grounded movement blocked (facade or solid); green ring = raised walkable top. */
  private drawCollisionOverlay(): void {
    this.overlay = this.add.container(0, 0).setDepth(OVERLAY_DEPTH);
    for (let y = 0; y < EDITOR_GRID_SIZE; y++) {
      for (let x = 0; x < EDITOR_GRID_SIZE; x++) {
        const cx = x * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
        const cy = y * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
        if (!this.store.world.isWalkable(x, y)) {
          this.overlay.add(
            this.add.rectangle(cx, cy, SCREEN_TILE_PX, SCREEN_TILE_PX, BLOCKED_TINT, 0.28),
          );
        } else if (this.store.world.heightAt(x, y) >= 1) {
          const ring = this.add.rectangle(cx, cy, SCREEN_TILE_PX - 6, SCREEN_TILE_PX - 6);
          ring.setStrokeStyle(2, RAISED_TINT, 0.8);
          this.overlay.add(ring);
        }
      }
    }
  }
}
