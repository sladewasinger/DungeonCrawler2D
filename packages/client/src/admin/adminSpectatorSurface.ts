import { createDebugFlags, type AdminMap, type DebugFlags } from "@dc2d/engine";
import {
  adminMapPointerWorldPoint,
  adminMapPointerCanvasPoint,
  adminMapLocationChanged,
  adminMapTileCenter,
  panAdminMapCenter,
  type AdminMapCenter,
} from "./map/adminMapCamera.js";
import { AdminMapCanvasInteractions } from "./map/camera/adminMapCanvasInteractions.js";
import { AdminMapKeyboardPan } from "./map/camera/adminMapKeyboardPan.js";
import { adminMapViewportRadius } from "./map/camera/adminMapZoom.js";
import { AdminMapZoomState } from "./map/camera/zoom/adminMapZoomState.js";
import type { AdminMapZoomDirection } from "./map/camera/adminMapZoom.js";
import { deletableAdminEntityAt } from "./map/adminMapEntityHitTest.js";
import { renderAdminMap } from "./map/adminMapRenderer.js";
import type {
  AdminSpawnSelection,
  AdminSpectatorSurfaceOptions,
} from "./map/adminMapSurfaceTypes.js";

export type { AdminSpawnSelection } from "./map/adminMapSurfaceTypes.js";

export class AdminSpectatorSurface {
  private readonly context: CanvasRenderingContext2D;
  private map: AdminMap | null = null;
  private cameraCenter: AdminMapCenter = { x: 0, y: 0 };
  private selection: AdminSpawnSelection = { kind: "enemy", defId: "" };
  private debugFlags: DebugFlags = createDebugFlags();
  private readonly zoomState = new AdminMapZoomState();
  private interactionEnabled = false;
  private readonly canvasInteractions: AdminMapCanvasInteractions;
  private readonly keyboardPan: AdminMapKeyboardPan;

  constructor(private readonly options: AdminSpectatorSurfaceOptions) {
    this.context = options.canvas.getContext("2d")!;
    options.canvas.tabIndex = 0;
    this.keyboardPan = new AdminMapKeyboardPan({
      canvas: options.canvas,
      onPan: (direction, elapsedMs) => this.pan(direction, elapsedMs),
    });
    this.canvasInteractions = new AdminMapCanvasInteractions({
      canvas: options.canvas,
      click: (event) => this.handleClick(event),
      contextMenu: (event) => this.handleContextMenu(event),
      mouseMove: (event) => this.updateCursor(event),
      mouseLeave: () => this.updateCursor(),
      pointerDown: () => options.canvas.focus(),
    });
    this.draw();
    options.onZoomChange(this.zoomState.percent);
  }

  setSelection(selection: AdminSpawnSelection): void { this.selection = selection; this.updateCursor(); }

  setInteractionEnabled(enabled: boolean): void { this.interactionEnabled = enabled; this.updateCursor(); }

  setMap(map: AdminMap | null): void {
    const shouldCenter = adminMapLocationChanged(this.map, map);
    this.map = map;
    if (map && shouldCenter) this.cameraCenter = adminMapTileCenter(map.center);
    this.updateCursor();
    this.draw();
  }

  get center(): AdminMapCenter {
    return this.cameraCenter;
  }

  get requiredMapRadius(): number {
    return adminMapViewportRadius({
      width: this.options.canvas.width,
      height: this.options.canvas.height,
      tileSize: this.zoomState.value,
    });
  }

  focus(center: AdminMapCenter): void {
    this.cameraCenter = adminMapTileCenter(center);
    this.draw();
  }

  focusInput(): void { this.options.canvas.focus(); }

  zoom(direction: AdminMapZoomDirection): void {
    this.options.onZoomChange(this.zoomState.zoom(direction));
    this.draw();
    this.focusInput();
  }

  resetZoom(): void {
    this.options.onZoomChange(this.zoomState.reset());
    this.draw();
    this.focusInput();
  }

  dispose(): void {
    this.canvasInteractions.dispose(); this.keyboardPan.dispose();
  }

  setDebugFlags(flags: DebugFlags): void {
    this.debugFlags = { ...flags };
    this.draw();
  }

  private pan(direction: AdminMapCenter, elapsedMs: number): void {
    this.cameraCenter = panAdminMapCenter({
      center: this.cameraCenter,
      direction,
      elapsedMs,
      tilesPerSecond: 6,
    });
    this.draw();
    this.options.onCameraMove(this.cameraCenter.x, this.cameraCenter.y);
  }

  private handleClick(event: MouseEvent): void {
    if (!this.canPlace() || !this.map) return;
    const point = adminMapPointerWorldPoint({
      event,
      canvas: this.options.canvas,
      center: this.cameraCenter,
      tileSize: this.zoomState.value,
    });
    this.options.onSpawn(point.x, point.y, this.selection);
  }

  private handleContextMenu(event: MouseEvent): void {
    const entity = this.deletableEntityAt(event);
    if (!this.interactionEnabled || !entity) return;
    this.options.onDespawn(entity.id);
  }

  private updateCursor(event?: MouseEvent): void {
    const entity = event ? this.deletableEntityAt(event) : null;
    this.options.canvas.style.cursor = entity && this.interactionEnabled
      ? "pointer"
      : this.canPlace() ? "crosshair" : "default";
  }

  private deletableEntityAt(event: MouseEvent) {
    if (!this.map) return null;
    return deletableAdminEntityAt({
      map: this.map,
      center: this.cameraCenter,
      canvas: this.options.canvas,
      tileSize: this.zoomState.value,
      point: adminMapPointerCanvasPoint({ event, canvas: this.options.canvas }),
    });
  }

  private canPlace(): boolean {
    return this.interactionEnabled && this.selection.placementAllowed !== false &&
      this.map !== null && this.selection.defId.length > 0;
  }

  private draw(): void {
    renderAdminMap({
      context: this.context,
      map: this.map,
      center: this.cameraCenter,
      tileSize: this.zoomState.value,
      debugFlags: this.debugFlags,
      unavailableMessage: this.interactionEnabled ? "Loading map…" : "Authenticate to load the map",
    });
  }
}
