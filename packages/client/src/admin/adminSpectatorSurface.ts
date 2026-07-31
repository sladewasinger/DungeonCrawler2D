import {
  createDebugFlags,
  type AdminMap,
  type DebugFlags,
} from "@dc2d/engine";
import {
  adminMapPointerWorldPoint,
  adminMapPointerCanvasPoint,
  moveAdminMapCenter,
  type AdminMapCenter,
} from "./map/adminMapCamera.js";
import { deletableAdminEntityAt } from "./map/adminMapEntityHitTest.js";
import { renderAdminMap } from "./map/adminMapRenderer.js";

export interface AdminSpawnSelection {
  readonly kind: "enemy" | "item" | "weapon";
  readonly defId: string;
}

export interface AdminSpectatorSurfaceOptions {
  readonly canvas: HTMLCanvasElement;
  readonly onCameraMove: (x: number, y: number) => void;
  readonly onSpawn: (x: number, y: number, selection: AdminSpawnSelection) => void;
  readonly onDespawn: (entityId: string) => void;
}

export class AdminSpectatorSurface {
  private readonly context: CanvasRenderingContext2D;
  private map: AdminMap | null = null;
  private cameraCenter: AdminMapCenter = { x: 0, y: 0 };
  private selection: AdminSpawnSelection = { kind: "enemy", defId: "" };
  private debugFlags: DebugFlags = createDebugFlags();
  private interactionEnabled = false;

  constructor(private readonly options: AdminSpectatorSurfaceOptions) {
    this.context = options.canvas.getContext("2d")!;
    options.canvas.tabIndex = 0;
    options.canvas.addEventListener("keydown", (event) => this.handleKey(event));
    options.canvas.addEventListener("click", (event) => this.handleClick(event));
    options.canvas.addEventListener("contextmenu", (event) => this.handleContextMenu(event));
    options.canvas.addEventListener("mousemove", (event) => this.updateCursor(event));
    options.canvas.addEventListener("mouseleave", () => this.updateCursor());
    this.draw();
  }

  setSelection(selection: AdminSpawnSelection): void {
    this.selection = selection;
    this.updateCursor();
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
    this.updateCursor();
  }

  setMap(map: AdminMap | null): void {
    this.map = map;
    if (map) this.cameraCenter = { ...map.center };
    this.updateCursor();
    this.draw();
  }

  setDebugFlags(flags: DebugFlags): void {
    this.debugFlags = { ...flags };
    this.draw();
  }

  private handleKey(event: KeyboardEvent): void {
    const direction = directionForKey(event.key);
    if (!direction) return;
    event.preventDefault();
    this.cameraCenter = moveAdminMapCenter(this.cameraCenter, direction);
    this.draw();
    this.options.onCameraMove(this.cameraCenter.x, this.cameraCenter.y);
  }

  private handleClick(event: MouseEvent): void {
    if (!this.interactionEnabled || !this.map || !this.selection.defId) return;
    const point = adminMapPointerWorldPoint({
      event,
      canvas: this.options.canvas,
      center: this.cameraCenter,
    });
    this.options.onSpawn(point.x, point.y, this.selection);
  }

  private handleContextMenu(event: MouseEvent): void {
    const entity = this.deletableEntityAt(event);
    if (!this.interactionEnabled || !entity) return;
    event.preventDefault();
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
      point: adminMapPointerCanvasPoint({ event, canvas: this.options.canvas }),
    });
  }

  private canPlace(): boolean {
    return this.interactionEnabled && this.map !== null && this.selection.defId.length > 0;
  }

  private draw(): void {
    renderAdminMap({
      context: this.context,
      map: this.map,
      center: this.cameraCenter,
      debugFlags: this.debugFlags,
    });
  }
}

const DIRECTIONS: Readonly<Record<string, AdminMapCenter>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
};

function directionForKey(key: string): AdminMapCenter | null {
  return DIRECTIONS[key] ?? DIRECTIONS[key.toLowerCase()] ?? null;
}
