import type { GeneratedFloor } from "@dc2d/engine";
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForEntity } from "../../render/entities/presentation/depthSort.js";
import { TerrainRenderer } from "../../render/terrain/index.js";
import { TERRAIN_CAMERA_BACKGROUND } from "../../render/terrain/runtime/renderSupport.js";
import { getViewOrientation } from "../../render/view/transform/viewState.js";
import { viewTileToWorld, worldToView } from "../../render/view/transform/viewTransform.js";
import { EditorTerrainWorld, EDITOR_TOOLS, type EditorPoint, type EditorTool } from "./EditorTerrainWorld.js";
import { EDITOR_FLOOR, editorSeedFromSearch } from "./editorSeed.js";
import { createEditorFloorRunner, type EditorFloorJob, type EditorFloorRunner } from "./editorFloorRunner.js";
import type { EditorBoot } from "./index.js";
import { EditorFixtureMarkers } from "./editorFixtureMarkers.js";

interface EditorSceneState {
  readonly terrain: TerrainRenderer;
  readonly world: EditorTerrainWorld;
}

export class EditorScene extends Phaser.Scene {
  private state: EditorSceneState | undefined;
  private floorRunner: EditorFloorRunner | undefined;
  private floorJob: EditorFloorJob | undefined;
  private disposed = false;
  private dummy: Phaser.GameObjects.Arc | undefined;
  private fixtureMarkers: EditorFixtureMarkers | undefined;
  private boot: EditorBoot | undefined;
  private tool: EditorTool = EDITOR_TOOLS.Height;
  private readonly onResetClick = () => this.resetMap();
  private readonly onToolClick = (event: Event) => this.selectTool(event);
  private readonly onCanvasWheel = (event: WheelEvent) => this.zoomCanvas(event);
  private readonly onPointerMove = (pointer: Phaser.Input.Pointer) => this.panCanvas(pointer);

  constructor() {
    super("editor");
  }

  create(): void {
    this.disposed = false;
    this.boot = this.registry.get("editorBoot") as EditorBoot | undefined;
    this.fixtureMarkers = new EditorFixtureMarkers(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposeEditor());
    this.floorRunner = createEditorFloorRunner();
    this.floorJob = this.floorRunner.request({
      worldSeed: editorSeedFromSearch(new URLSearchParams(window.location.search)),
      floor: EDITOR_FLOOR,
    });
    void this.floorJob.promise.then((floor) => this.initializeEditor(floor)).catch((error: unknown) => this.showGenerationError(error));
  }

  update(): void {
    this.state?.terrain.update(this.cameras.main.worldView);
    this.updateDummy();
    if (this.state) this.fixtureMarkers?.sync(this.state.world);
  }

  resetMap(): void {
    this.state?.world.reset();
    this.boot?.heightmap.render();
  }

  private configureCamera(bounds: NonNullable<EditorTerrainWorld["floorBounds"]>): void {
    const center = worldToView({
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    }, getViewOrientation());
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(center.x * SCREEN_TILE_PX, center.y * SCREEN_TILE_PX);
    this.cameras.main.setBackgroundColor(TERRAIN_CAMERA_BACKGROUND);
  }

  private initializeEditor(floor: GeneratedFloor): void {
    if (this.disposed) return;
    const world = new EditorTerrainWorld(floor);
    const terrain = new TerrainRenderer(this, world);
    this.state = { terrain, world };
    this.boot?.heightmap.setWorld(world);
    this.boot?.fileControls.setWorld(world);
    this.configureCamera(world.floorBounds);
    this.createDummy();
    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.paintPointer, this);
    this.bindControls();
    this.setGenerationStatus("Finite floor ready. Select a fixture tool or edit heights in the heightmap.");
  }

  private showGenerationError(error: unknown): void {
    if (this.disposed) return;
    const message = error instanceof Error ? error.message : "Finite floor generation failed.";
    this.setGenerationStatus(message);
  }

  private setGenerationStatus(message: string): void {
    const status = document.getElementById("editor-status");
    if (status) status.textContent = message;
  }

  private createDummy(): void {
    this.dummy = this.add.circle(0, 0, SCREEN_TILE_PX / 4, 0xffd23d);
    this.updateDummy();
  }

  private bindControls(): void {
    document.querySelector<HTMLElement>("[data-editor-tools]")?.addEventListener("click", this.onToolClick);
    document.getElementById("editor-reset")?.addEventListener("click", this.onResetClick);
    this.game.canvas.addEventListener("wheel", this.onCanvasWheel, { passive: false });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
  }

  private paintPointer(pointer: Phaser.Input.Pointer): void {
    pointer.event?.preventDefault();
    if (pointer.middleButtonDown()) return;
    const point = this.pointAt(pointer);
    if (!point || !this.state) return;
    if (pointer.rightButtonDown()) this.state.world.lowerAt(point.x, point.y);
    else if (this.tool === EDITOR_TOOLS.Height) this.state.world.raiseAt(point.x, point.y);
    else this.state.world.paintAt(point.x, point.y, this.tool);
    this.boot?.heightmap.render();
  }

  private selectTool(event: Event): void {
    const tool = (event.target as HTMLElement).dataset.editorTool as EditorTool | undefined;
    if (!tool) return;
    this.tool = tool;
    this.setGenerationStatus(`Tool: ${tool}. Heightmap left/right click remains raise/lower.`);
  }

  private panCanvas(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || !pointer.middleButtonDown()) return;
    this.cameras.main.scrollX -= pointer.x - pointer.prevPosition.x;
    this.cameras.main.scrollY -= pointer.y - pointer.prevPosition.y;
  }

  private zoomCanvas(event: WheelEvent): void {
    event.preventDefault();
    const next = Phaser.Math.Clamp(this.cameras.main.zoom + (event.deltaY < 0 ? 0.1 : -0.1), 0.25, 4);
    this.cameras.main.setZoom(next);
  }

  private pointAt(pointer: Phaser.Input.Pointer): EditorPoint | null {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const view = { x: Math.floor(worldPoint.x / SCREEN_TILE_PX), y: Math.floor(worldPoint.y / SCREEN_TILE_PX) };
    const { x, y } = viewTileToWorld(view, getViewOrientation());
    const point = { x, y };
    return this.state?.world.contains(point) ? point : null;
  }

  private updateDummy(): void {
    if (!this.dummy || !this.state) return;
    const point = worldToView({ x: 10, y: 10 }, getViewOrientation());
    const height = this.state.world.heightAt(10, 10);
    this.dummy.setPosition((point.x + 0.5) * SCREEN_TILE_PX, (point.y + 0.5 - height) * SCREEN_TILE_PX);
    this.dummy.setDepth(depthForEntity(point.y + 0.75));
  }

  private disposeEditor(): void {
    this.disposed = true;
    this.floorJob?.cancel();
    this.floorRunner?.dispose();
    this.state?.terrain.dispose();
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.paintPointer, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.game.canvas.removeEventListener("wheel", this.onCanvasWheel);
    document.querySelector<HTMLElement>("[data-editor-tools]")?.removeEventListener("click", this.onToolClick);
    document.getElementById("editor-reset")?.removeEventListener("click", this.onResetClick);
    this.boot?.dispose();
    this.fixtureMarkers?.dispose();
  }
}
