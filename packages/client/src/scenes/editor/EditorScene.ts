// The editor's right panel: renders the painted world through the REAL terrain
// pipeline (buildChunkVisual — same faces/rims/corners the game draws), with an
// optional collision overlay proving the pixels and the blocking rules agree. Also
// drives the REAL entity/vfx renderer for Epic 7.11's effects bench: SIMULATE ticks
// bench/index.ts's local sim, and every frame its state is synced through the same
// EntityRenderer + VfxSystem the live dungeon scene uses.
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { EntityRenderer, type RenderContext } from "../../render/entities/index.js";
import { buildChunkVisual, destroyChunkVisual, type ChunkVisual } from "../../render/terrain/chunkVisual.js";
import { LIGHT_MAX, type DynamicLightSeed } from "../../render/terrain/tileLight.js";
import { VfxSystem } from "../../vfx/index.js";
import { advanceBench, benchAreaTileViews, benchItemViews, benchMonsterViews } from "./bench/index.js";
import { EDITOR_GRID_SIZE } from "./EditableWorld.js";
import type { EditorStore } from "./editorStore.js";

const OVERLAY_DEPTH = 1_000_000_000;
const BLOCKED_TINT = 0xe04a4a;
const RAISED_TINT = 0x7bd44a;

export class EditorScene extends Phaser.Scene {
  private store!: EditorStore;
  private visual: ChunkVisual | undefined;
  private overlay: Phaser.GameObjects.Container | undefined;
  private entityRenderer!: EntityRenderer;
  private vfx!: VfxSystem;

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
    this.entityRenderer = new EntityRenderer(this);
    this.vfx = new VfxSystem(this);
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
    if (this.visual) destroyChunkVisual(this.visual);
    this.overlay?.destroy(true);
    this.overlay = undefined;
    // The 20x20 grid lives inside chunk (0,0); out-of-grid cells read as chasm
    // void, so the island frames itself. Stamped torches seed the bake exactly like
    // world torches — the editor's whole point is previewing the real lighting pipeline.
    this.visual = buildChunkVisual(this, this.store.world, 0, 0, this.torchSeeds());
    if (this.store.showCollision) this.drawCollisionOverlay();
  }

  private torchSeeds(): DynamicLightSeed[] {
    return this.store.world
      .torchPositions()
      .map((t) => ({ tileX: t.wx, tileY: t.wy, level: LIGHT_MAX }));
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
