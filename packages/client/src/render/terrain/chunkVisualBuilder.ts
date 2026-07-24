/** Builds one terrain chunk in bounded stages so streaming never performs a monolithic bake. */
import { CHUNK_SIZE } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { BASE_TERRAIN_DEPTH } from "../entities/depthSort.js";
import { drawTile } from "./drawTile.js";
import { planStripAtlas, type AtlasPlan } from "./stripAtlas.js";
import { acquireStripPage, pagePoolFor, releasePage } from "./terrainPages.js";
import {
  collectCapStrips,
  collectFaceStrips,
  makeCapOccluderFor,
  makeOccluderFor,
  type CapRow,
  type OccluderRow,
  type PendingStrip,
} from "./stripRows.js";
import { buildStructureMap, drawDoor, type StructureMap } from "./structures.js";
import { computeLightField, type DynamicLightSeed, type LightField } from "./tileLight.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { viewChunkWorldOrigin, viewWorld, type ViewTerrainWorld } from "./viewWorld.js";
import type { ChunkVisual, ChunkVisualBuilder } from "./chunkVisualTypes.js";

const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;
const ROWS_PER_STEP = 1;
const IMAGES_PER_STEP = 8;
type BuildPhase = "page" | "structures" | "light" | "tiles" | "collect" | "pages" | "bake" | "images";

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

export class IncrementalChunkVisualBuilder implements ChunkVisualBuilder {
  private phase: BuildPhase = "page";
  private readonly rows = new Map<number, OccluderRow>();
  private readonly capRows = new Map<number, CapRow>();
  private readonly occluderFor;
  private readonly capOccluderFor;
  private readonly view: ViewTerrainWorld;
  private readonly baseVX: number;
  private readonly baseVY: number;
  private readonly originX: number; private readonly originY: number;
  private basePage: Phaser.Textures.DynamicTexture | null = null;
  private structures: StructureMap | null = null;
  private light: LightField | null = null;
  private nextRow = 0;
  private strips: PendingStrip[] = [];
  private plan: AtlasPlan = { pageHeights: [], strips: [] };
  private readonly pages: Phaser.Textures.DynamicTexture[] = [];
  private bakedPages = 0;
  private baseImage: Phaser.GameObjects.Image | null = null;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private completed = false;

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
    this.originX = this.baseVX * SCREEN_TILE_PX;
    this.originY = this.baseVY * SCREEN_TILE_PX;
    this.occluderFor = makeOccluderFor(scene, this.rows);
    this.capOccluderFor = makeCapOccluderFor(scene, this.capRows);
  }

  step(): ChunkVisual | null {
    if (this.completed) return null;
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

  cancel(): void {
    if (this.completed) return;
    this.baseImage?.destroy();
    for (const image of this.images) image.destroy();
    for (const row of this.rows.values()) if (row.container.active) row.container.destroy(true);
    for (const row of this.capRows.values()) if (row.container.active) row.container.destroy(true);
    if (this.basePage) releasePage(this.basePage, "base");
    for (const page of this.pages) releasePage(page, "strip");
    this.completed = true;
  }

  private acquireBasePage(): null {
    this.basePage = pagePoolFor(this.scene.textures, "base").acquire();
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
    below.setPosition(-this.originX, -this.originY);
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
    this.plan = planStripAtlas(this.strips.map((strip) => strip.stripHeight));
    this.phase = "pages";
    return null;
  }

  private acquirePage(): null {
    const height = this.plan.pageHeights[this.pages.length];
    if (height !== undefined) this.pages.push(acquireStripPage(this.scene.textures, height));
    if (this.pages.length === this.plan.pageHeights.length) this.phase = "bake";
    return null;
  }

  private bakePage(): null {
    const page = this.pages[this.bakedPages];
    if (page) {
      page.beginDraw();
      this.strips.forEach((strip, index) => this.drawStripOnPage(page, strip, index));
      page.endDraw();
      this.bakedPages++;
    }
    if (this.bakedPages === this.pages.length) {
      this.baseImage = this.scene.add.image(this.originX, this.originY, required(this.basePage, "chunk build has no base page"))
        .setOrigin(0, 0).setDepth(BASE_TERRAIN_DEPTH).setName("terrain-base").setVisible(false);
      this.phase = "images";
    }
    return null;
  }

  private drawStripOnPage(page: Phaser.Textures.DynamicTexture, strip: PendingStrip, index: number): void {
    const packed = this.plan.strips[index];
    if (!packed || this.pages[packed.page] !== page) return;
    strip.container.setPosition(-this.originX, packed.bandY - strip.stripTop);
    page.batchDraw(strip.container);
  }

  private createImages(): ChunkVisual | null {
    const end = Math.min(this.strips.length, this.images.length + IMAGES_PER_STEP);
    for (let index = this.images.length; index < end; index++) this.createStripImage(index);
    if (end < this.strips.length) return null;
    return this.finish();
  }

  private createStripImage(index: number): void {
    const strip = this.strips[index];
    const packed = this.plan.strips[index];
    if (!strip || !packed) return;
    const page = this.pages[packed.page];
    if (!page) return;
    strip.container.destroy(true);
    page.add(`s${index}`, 0, 0, packed.bandY, CHUNK_PX, strip.stripHeight);
    this.images.push(this.scene.add.image(this.originX, strip.stripTop, page, `s${index}`)
      .setOrigin(0, 0).setDepth(strip.depth).setName("terrain-strip").setVisible(false));
  }

  private finish(): ChunkVisual {
    const below = required(this.baseImage, "chunk build has no base image");
    below.setVisible(true);
    for (const image of this.images) image.setVisible(true);
    this.completed = true;
    return {
      cx: this.cx,
      cy: this.cy,
      below,
      belowPage: required(this.basePage, "chunk build has no base page"),
      occluders: this.images,
      atlasPages: this.pages,
    };
  }
}
