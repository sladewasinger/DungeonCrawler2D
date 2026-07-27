/** Builds one terrain chunk in bounded stages so streaming never performs a monolithic bake. */
import { CHUNK_SIZE } from "@dc2d/engine";
import type Phaser from "phaser";
import { BASE_TERRAIN_DEPTH } from "../entities/depthSort.js";
import { IMAGES_PER_STEP, required, ROWS_PER_STEP, STRIPS_PER_BAKE_STEP, type BuildPhase } from "./chunkBuildPolicy.js";
import { createStripPageImage, createStructureOverlays } from "./chunkVisualOutput.js";
import { drawTile } from "./drawTile.js";
import { planStripAtlas, type AtlasPlan } from "./stripAtlas.js";
import { acquireStripPage, pagePoolFor } from "./terrainPages.js";
import { collectCapStrips, collectFaceStrips, makeCapOccluderFor, makeOccluderFor, type CapRow, type OccluderRow, type PendingStrip } from "./stripRows.js";
import { buildStructureMap, drawDoor, type StructureMap } from "./structures.js";
import { computeLightField, type DynamicLightSeed, type LightField } from "./tileLight.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { viewChunkWorldOrigin, viewWorld, type ViewTerrainWorld } from "./viewWorld.js";
import type { ChunkVisual, ChunkVisualBuilder } from "./chunkVisualTypes.js";
import { TERRAIN_BAKE_TILE_PX } from "./terrainMetrics.js";
import { createTerrainPageImage } from "./terrainPageImage.js";
import { cancelChunkVisualBuild, finishChunkVisual } from "./chunkVisualLifecycle.js";

export class IncrementalChunkVisualBuilder implements ChunkVisualBuilder {
  private phase: BuildPhase = "page";
  private readonly rows = new Map<number, OccluderRow>();
  private readonly capRows = new Map<number, CapRow>();
  private readonly occluderFor;
  private readonly capOccluderFor;
  private readonly view: ViewTerrainWorld;
  private readonly baseVX: number; private readonly baseVY: number;
  private readonly originBakeX: number; private readonly originBakeY: number;
  private basePage: Phaser.Textures.DynamicTexture | null = null; private structures: StructureMap | null = null; private light: LightField | null = null;
  private nextRow = 0;
  private strips: PendingStrip[] = [];
  private plan: AtlasPlan = { pageHeights: [], strips: [] };
  private readonly pages: Phaser.Textures.DynamicTexture[] = [];
  private bakedPages = 0; private nextBakeStrip = 0;
  private baseImage: Phaser.GameObjects.Image | null = null; private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly overlays: Phaser.GameObjects.Text[] = [];
  private completed = false; private blockedOnPageBudget = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: TerrainWorld,
    readonly cx: number,
    readonly cy: number,
    orientation: ViewOrientation,
    private readonly dynamicLights: readonly DynamicLightSeed[],
  ) {
    this.view = viewWorld(world, orientation);
    this.baseVX = cx * CHUNK_SIZE;
    this.baseVY = cy * CHUNK_SIZE;
    this.originBakeX = this.baseVX * TERRAIN_BAKE_TILE_PX;
    this.originBakeY = this.baseVY * TERRAIN_BAKE_TILE_PX;
    this.occluderFor = makeOccluderFor(scene, this.rows);
    this.capOccluderFor = makeCapOccluderFor(scene, this.capRows);
  }

  step(): ChunkVisual | null {
    if (this.completed) return null;
    this.blockedOnPageBudget = false;
    switch (this.phase) {
      case "page": return this.acquireBasePage();
      case "structures": return this.buildStructures();
      case "light": return this.buildLight();
      case "tiles": return this.drawRows();
      case "collect": return this.collectStrips();
      case "pages": return this.acquirePage();
      case "bake": return this.bakePage();
      case "images": return this.createImages();
    }
  }

  get pageBudgetBlocked(): boolean {
    return this.blockedOnPageBudget;
  }

  cancel(): void {
    if (this.completed) return;
    const containers = [...this.rows.values(), ...this.capRows.values()].map((row) => row.container);
    cancelChunkVisualBuild(this.baseImage, this.images, this.overlays, containers, this.basePage, this.pages);
    this.completed = true;
  }

  private acquireBasePage(): null {
    const page = pagePoolFor(this.scene.textures, "base").acquire();
    if (!page) {
      this.blockedOnPageBudget = true;
      return null;
    }
    this.basePage = page;
    this.phase = "structures";
    return null;
  }

  private buildStructures(): null {
    this.structures = buildStructureMap(
      (vx, vy) => this.view.tileAt(vx, vy),
      this.baseVX,
      this.baseVY,
      this.baseVX + CHUNK_SIZE,
      this.baseVY + CHUNK_SIZE,
    );
    this.phase = "light";
    return null;
  }

  private buildLight(): null {
    const origin = viewChunkWorldOrigin(this.baseVX, this.baseVY, CHUNK_SIZE, this.view.orientation);
    this.light = computeLightField(this.world, origin.x, origin.y, CHUNK_SIZE, this.dynamicLights);
    this.phase = "tiles";
    return null;
  }

  private drawRows(): null {
    const page = required(this.basePage, "chunk build has no base page");
    const structures = required(this.structures, "chunk build has no structures");
    const light = required(this.light, "chunk build has no light field");
    const below = this.scene.add.container(0, 0);
    const end = Math.min(CHUNK_SIZE, this.nextRow + ROWS_PER_STEP);
    for (let ly = this.nextRow; ly < end; ly++) {
      const vy = this.baseVY + ly;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        drawTile(this.scene, this.view, this.baseVX + lx, vy, below, this.occluderFor, this.capOccluderFor, structures, light);
      }
    }
    below.setPosition(-this.originBakeX, -this.originBakeY);
    page.draw(below);
    below.destroy(true);
    for (const row of this.rows.values()) this.scene.children.remove(row.container);
    for (const row of this.capRows.values()) this.scene.children.remove(row.container);
    this.nextRow = end;
    if (end === CHUNK_SIZE) this.phase = "collect";
    return null;
  }

  private collectStrips(): null {
    const structures = required(this.structures, "chunk build has no structures");
    for (const door of structures.doors) drawDoor(this.scene, this.occluderFor(door.wy), door);
    this.strips = [...collectFaceStrips(this.rows), ...collectCapStrips(this.capRows)];
    this.plan = planStripAtlas(this.strips.map((strip) => strip.stripHeightBakePx));
    this.phase = "pages";
    return null;
  }

  private acquirePage(): null {
    const height = this.plan.pageHeights[this.pages.length];
    if (height !== undefined) {
      const page = acquireStripPage(this.scene.textures, height);
      if (!page) {
        this.blockedOnPageBudget = true;
        return null;
      }
      this.pages.push(page);
    }
    if (this.pages.length === this.plan.pageHeights.length) this.phase = "bake";
    return null;
  }

  private bakePage(): null {
    const page = this.pages[this.bakedPages];
    if (page) {
      for (let drawn = 0; drawn < STRIPS_PER_BAKE_STEP; drawn++) {
        const strip = this.strips[this.nextBakeStrip];
        const packed = this.plan.strips[this.nextBakeStrip];
        if (!strip || !packed || packed.page !== this.bakedPages) break;
        this.drawStripOnPage(page, strip, this.nextBakeStrip++);
      }
      // Phaser 4 replaced DynamicTexture's beginDraw/endDraw command batch with
      // draw()+render(). The page remains resident and is rendered once per build
      // slice, so old pages stay visible until the replacement is complete.
      page.render();
      const next = this.plan.strips[this.nextBakeStrip];
      if (!next || next.page !== this.bakedPages) this.bakedPages++;
    }
    if (this.bakedPages === this.pages.length) {
      this.baseImage = createTerrainPageImage(
        this.scene,
        this.originBakeX,
        this.originBakeY,
        required(this.basePage, "chunk build has no base page"),
        BASE_TERRAIN_DEPTH,
        "terrain-base",
      );
      this.phase = "images";
    }
    return null;
  }

  private drawStripOnPage(page: Phaser.Textures.DynamicTexture, strip: PendingStrip, index: number): void {
    const packed = this.plan.strips[index];
    if (!packed || this.pages[packed.page] !== page) return;
    strip.container.setPosition(-this.originBakeX, packed.bandY - strip.stripTopBakePx);
    page.draw(strip.container);
  }

  private createImages(): ChunkVisual | null {
    const end = Math.min(this.strips.length, this.images.length + IMAGES_PER_STEP);
    for (let index = this.images.length; index < end; index++) this.createStripImage(index);
    if (end < this.strips.length) return null;
    this.overlays.push(...createStructureOverlays(
      this.scene, required(this.structures, "chunk build has no structures"),
    ));
    const below = required(this.baseImage, "chunk build has no base image");
    this.completed = true;
    return finishChunkVisual(
      this.cx, this.cy, below, required(this.basePage, "chunk build has no base page"),
      this.images, this.overlays, this.pages,
    );
  }

  private createStripImage(index: number): void {
    const strip = this.strips[index]; const packed = this.plan.strips[index];
    if (!strip || !packed) return;
    const page = this.pages[packed.page]; if (!page) return;
    this.images.push(createStripPageImage(
      this.scene, this.originBakeX, strip, packed, page, index,
    ));
  }
}
