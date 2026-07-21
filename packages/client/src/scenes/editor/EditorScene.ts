// The editor's right panel: renders the painted world through the REAL terrain
// pipeline (buildChunkVisual — same faces/rims/corners the game draws), with an
// optional collision overlay proving the pixels and the blocking rules agree. Also
// drives the REAL entity/vfx renderer for Epic 7.11's effects bench: SIMULATE ticks
// bench/index.ts's local sim, and every frame its state is synced through the same
// EntityRenderer + VfxSystem the live dungeon scene uses.
//
// LANE W3: this panel now rotates through the exact same render/view seam the game
// uses (paintPanel/viewSection.ts drives EditorStore.rotateView) — no editor-special
// rendering path. Click-painting (renderPanelPointer.ts) remaps pointer -> viewToWorld
// -> the correct WORLD cell at every orientation, sharing the left (north-fixed) data
// grid's own brush/erase semantics (paintAction.ts) and inspector readout.
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { EntityRenderer, type RenderContext } from "../../render/entities/index.js";
import { buildChunkVisual, destroyChunkVisual, type ChunkVisual } from "../../render/terrain/chunkVisual.js";
import { islandChunkCoords, islandViewCentroid } from "../../render/terrain/islandChunk.js";
import { LIGHT_MAX, type DynamicLightSeed } from "../../render/terrain/tileLight.js";
import { getViewOrientation, worldTileToView, type ViewOrientation } from "../../render/view/index.js";
import { VfxSystem } from "../../vfx/index.js";
import { advanceBench, benchAreaTileViews, benchItemViews, benchMonsterViews } from "./bench/index.js";
import { EDITOR_GRID_SIZE } from "./EditableWorld.js";
import type { EditorStore } from "./editorStore.js";
import { wireRenderPanelPointer } from "./renderPanelPointer.js";

const OVERLAY_DEPTH = 1_000_000_000;
const PREVIEW_DEPTH = OVERLAY_DEPTH + 1;
const BLOCKED_TINT = 0xe04a4a;
const RAISED_TINT = 0x7bd44a;
const PREVIEW_COLOR = 0xffd23d;

export interface EditorSceneData {
  readonly store: EditorStore;
  readonly refreshGrid: () => void;
  readonly setInspectorText: (text: string) => void;
}

export class EditorScene extends Phaser.Scene {
  private store!: EditorStore;
  private refreshGrid!: () => void;
  private setInspectorText!: (text: string) => void;
  private visuals: ChunkVisual[] = [];
  private overlay: Phaser.GameObjects.Container | undefined;
  private paintPreview!: Phaser.GameObjects.Rectangle;
  private entityRenderer!: EntityRenderer;
  private vfx!: VfxSystem;

  constructor() {
    super("editor");
  }

  init(data: EditorSceneData): void {
    this.store = data.store;
    this.refreshGrid = data.refreshGrid;
    this.setInspectorText = data.setInspectorText;
  }

  create(): void {
    const worldPx = EDITOR_GRID_SIZE * SCREEN_TILE_PX;
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(Math.min(this.scale.width, this.scale.height) / worldPx);
    this.entityRenderer = new EntityRenderer(this);
    this.vfx = new VfxSystem(this);
    this.paintPreview = this.add
      .rectangle(0, 0, SCREEN_TILE_PX, SCREEN_TILE_PX)
      .setStrokeStyle(2, PREVIEW_COLOR, 0.9)
      .setFillStyle(PREVIEW_COLOR, 0.12)
      .setDepth(PREVIEW_DEPTH)
      .setVisible(false);
    wireRenderPanelPointer(this, this.store, this.paintPreview, {
      refreshGrid: this.refreshGrid,
      setInspectorText: this.setInspectorText,
    });
    this.store.onChange(() => this.rebuild());
    this.rebuild();
  }

  /** Advances SIMULATE (no-op while paused) and syncs the bench's live state onto the
   * real area-vfx and entity-sprite renderers every frame. */
  update(time: number, delta: number): void {
    const bench = this.store.bench;
    advanceBench(bench, delta);
    this.vfx.syncAreas(benchAreaTileViews(bench));
    const ctx: RenderContext = {
      world: bench.world,
      nowMs: time,
      dtSeconds: delta / 1000,
      selfX: bench.dummy.body.x,
      selfY: bench.dummy.body.y,
      partyIds: new Set(),
    };
    this.entityRenderer.syncMonsters(benchMonsterViews(bench), ctx);
    this.entityRenderer.syncItems(benchItemViews(bench), time);
    this.vfx.update(time);
  }

  private rebuild(): void {
    for (const visual of this.visuals) destroyChunkVisual(visual);
    this.overlay?.destroy(true);
    this.overlay = undefined;
    const orientation = getViewOrientation();
    this.frameCamera(orientation);
    // The 20x20 grid lives inside exactly one CHUNK_SIZE-square chunk at orientation 0;
    // out-of-grid cells read as chasm void, so the island frames itself. At the other 3
    // orientations, the island's rotated bounding box can straddle a chunk boundary
    // (render/terrain/islandChunk.ts's doc comment) — islandChunkCoords returns every
    // chunk actually needed, up to 4, and every one must be built.
    const torchSeeds = this.torchSeeds();
    this.visuals = islandChunkCoords(orientation, EDITOR_GRID_SIZE).map(({ cx, cy }) =>
      buildChunkVisual(this, this.store.world, cx, cy, orientation, torchSeeds),
    );
    if (this.store.showCollision) this.drawCollisionOverlay(orientation);
  }

  /** The camera must center on the island's ROTATED centroid, not its fixed world
   * pixel center — the island itself moves under rotation (islandChunk.ts's doc comment). */
  private frameCamera(orientation: ViewOrientation): void {
    const centroid = islandViewCentroid(orientation, EDITOR_GRID_SIZE);
    this.cameras.main.centerOn(centroid.x * SCREEN_TILE_PX, centroid.y * SCREEN_TILE_PX);
  }

  private torchSeeds(): DynamicLightSeed[] {
    return this.store.world
      .torchPositions()
      .map((t) => ({ tileX: t.wx, tileY: t.wy, level: LIGHT_MAX }));
  }

  /** Red = grounded movement blocked (facade or solid); green ring = raised walkable
   * top. Drawn at each WORLD cell's rotated SCREEN position (worldToView) — the
   * collision truth itself always stays WORLD-space; only the overlay's placement maps
   * through the seam. */
  private drawCollisionOverlay(orientation: ViewOrientation): void {
    this.overlay = this.add.container(0, 0).setDepth(OVERLAY_DEPTH);
    for (let y = 0; y < EDITOR_GRID_SIZE; y++) {
      for (let x = 0; x < EDITOR_GRID_SIZE; x++) {
        const view = worldTileToView({ x, y }, orientation);
        const cx = view.x * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
        const cy = view.y * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
        if (!this.store.world.isWalkable(x, y)) {
          this.overlay.add(this.add.rectangle(cx, cy, SCREEN_TILE_PX, SCREEN_TILE_PX, BLOCKED_TINT, 0.28));
        } else if (this.store.world.heightAt(x, y) >= 1) {
          const ring = this.add.rectangle(cx, cy, SCREEN_TILE_PX - 6, SCREEN_TILE_PX - 6);
          ring.setStrokeStyle(2, RAISED_TINT, 0.8);
          this.overlay.add(ring);
        }
      }
    }
  }
}
