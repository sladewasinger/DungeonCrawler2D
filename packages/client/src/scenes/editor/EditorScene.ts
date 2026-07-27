import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForEntity } from "../../render/entities/presentation/depthSort.js";
import { Terrain4Renderer } from "../../render/terrain4/index.js";
import { getViewOrientation } from "../../render/view/transform/viewState.js";
import { viewTileToWorld, worldToView } from "../../render/view/transform/viewTransform.js";
import { EDITOR_GRID_SIZE, EditorTerrainWorld, type EditorPoint } from "./EditorTerrainWorld.js";

interface EditorSceneState {
  readonly terrain: Terrain4Renderer;
  readonly world: EditorTerrainWorld;
}

export class EditorScene extends Phaser.Scene {
  private state: EditorSceneState | undefined;
  private stairStart: EditorPoint | undefined;
  private stairMode = false;
  private dummy: Phaser.GameObjects.Arc | undefined;
  private stairMarker: Phaser.GameObjects.Rectangle | undefined;
  private readonly onStairsClick = () => this.enableStairMode();
  private readonly onResetClick = () => this.resetMap();

  constructor() {
    super("editor");
  }

  create(): void {
    const world = new EditorTerrainWorld();
    const terrain = new Terrain4Renderer(this, world);
    this.state = { terrain, world };
    this.configureCamera();
    this.createDummy();
    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.paintPointer, this);
    this.bindControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposeEditor(terrain));
  }

  update(): void {
    this.state?.terrain.update(this.cameras.main.worldView);
    this.updateDummy();
  }

  resetMap(): void {
    this.state?.world.reset();
    this.stairStart = undefined;
    this.stairMode = false;
    this.stairMarker?.setVisible(false);
  }

  enableStairMode(): void {
    this.stairStart = undefined;
    this.stairMode = true;
  }

  private configureCamera(): void {
    const center = worldToView({ x: EDITOR_GRID_SIZE / 2, y: EDITOR_GRID_SIZE / 2 }, getViewOrientation());
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(center.x * SCREEN_TILE_PX, center.y * SCREEN_TILE_PX);
    this.cameras.main.setBackgroundColor("#14141c");
  }

  private createDummy(): void {
    this.dummy = this.add.circle(0, 0, SCREEN_TILE_PX / 4, 0xffd23d);
    this.updateDummy();
  }

  private bindControls(): void {
    document.getElementById("editor-stairs")?.addEventListener("click", this.onStairsClick);
    document.getElementById("editor-reset")?.addEventListener("click", this.onResetClick);
  }

  private paintPointer(pointer: Phaser.Input.Pointer): void {
    pointer.event?.preventDefault();
    const point = this.pointAt(pointer);
    if (!point || !this.state) return;
    if (this.stairMode) return this.selectStairPoint(point);
    if (pointer.rightButtonDown()) this.state.world.lowerAt(point.x, point.y);
    else this.state.world.raiseAt(point.x, point.y);
  }

  private pointAt(pointer: Phaser.Input.Pointer): EditorPoint | null {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const view = { x: Math.floor(worldPoint.x / SCREEN_TILE_PX), y: Math.floor(worldPoint.y / SCREEN_TILE_PX) };
    const { x, y } = viewTileToWorld(view, getViewOrientation());
    if (x < 0 || y < 0 || x >= EDITOR_GRID_SIZE || y >= EDITOR_GRID_SIZE) return null;
    return { x, y };
  }

  private placeStair(destination: EditorPoint): void {
    const start = this.stairStart;
    if (!start || !this.state) return;
    if (!this.state.world.placeStair({ start, destination })) return;
    this.resetStairMode();
  }

  private selectStairPoint(point: EditorPoint): void {
    if (!this.stairStart) {
      this.stairStart = point;
      this.showStairMarker(point);
      return;
    }
    this.placeStair(point);
  }

  private updateDummy(): void {
    if (!this.dummy || !this.state) return;
    const point = worldToView({ x: 10, y: 10 }, getViewOrientation());
    const height = this.state.world.heightAt(10, 10);
    this.dummy.setPosition((point.x + 0.5) * SCREEN_TILE_PX, (point.y + 0.5 - height) * SCREEN_TILE_PX);
    this.dummy.setDepth(depthForEntity(point.y + 0.75));
  }

  private showStairMarker(point: EditorPoint): void {
    const view = worldToView(point, getViewOrientation());
    this.stairMarker ??= this.add.rectangle(0, 0, SCREEN_TILE_PX, SCREEN_TILE_PX).setStrokeStyle(2, 0xffd23d);
    this.stairMarker.setPosition((view.x + 0.5) * SCREEN_TILE_PX, (view.y + 0.5) * SCREEN_TILE_PX).setVisible(true);
  }

  private resetStairMode(): void {
    this.stairStart = undefined;
    this.stairMode = false;
    this.stairMarker?.setVisible(false);
  }

  private disposeEditor(terrain: Terrain4Renderer): void {
    terrain.dispose();
    document.getElementById("editor-stairs")?.removeEventListener("click", this.onStairsClick);
    document.getElementById("editor-reset")?.removeEventListener("click", this.onResetClick);
  }
}
