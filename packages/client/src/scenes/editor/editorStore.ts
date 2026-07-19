// The editor's single mutable home: the painted world, the active brush, and
// change notification. Persists to localStorage on every stroke; seeds a demo
// pattern on first launch so the renderer has something to prove immediately.
import { TILE, type TileType } from "@dc2d/engine";
import { EditableWorld } from "./EditableWorld.js";

const STORAGE_KEY = "dc2d-editor-map-v1";

export type Brush =
  | { readonly kind: "height"; readonly value: number }
  | { readonly kind: "rock" }
  | { readonly kind: "door" }
  | { readonly kind: "erase" };

/** Rock masses paint one z-unit above the tallest orthogonal neighbor floor, min 1. */
function rockHeightAround(world: EditableWorld, wx: number, wy: number): number {
  let base = 0;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const cell = world.cellAt(wx + dx, wy + dy);
    if (cell.tile !== TILE.Wall) base = Math.max(base, cell.height);
  }
  return base + 1;
}

export class EditorStore {
  readonly world = new EditableWorld();
  brush: Brush = { kind: "height", value: 1 };
  showCollision = false;
  private readonly listeners = new Set<() => void>();

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.world.load(JSON.parse(saved) as { tiles: number[]; heights: number[] });
        return;
      } catch {
        // Corrupt save: fall through to the demo pattern.
      }
    }
    this.seedDemoPattern();
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  paint(wx: number, wy: number): void {
    if (!this.world.inGrid(wx, wy)) return;
    const brush = this.brush;
    if (brush.kind === "height") this.world.setCell(wx, wy, TILE.Floor, brush.value);
    else if (brush.kind === "erase") this.world.setCell(wx, wy, TILE.Floor, 0);
    else if (brush.kind === "rock") {
      this.world.setCell(wx, wy, TILE.Wall, rockHeightAround(this.world, wx, wy));
    } else if (this.world.tileAt(wx, wy) === TILE.Wall) {
      // Door stamps require an existing rock cell: the portal punches INTO a wall.
      this.world.setCell(wx, wy, TILE.DoorSafeRoom, this.world.heightAt(wx, wy));
    }
    this.commit();
  }

  setTileDirect(wx: number, wy: number, tile: TileType, height: number): void {
    this.world.setCell(wx, wy, tile, height);
  }

  toggleCollision(): void {
    this.showCollision = !this.showCollision;
    this.notify();
  }

  exportJson(): string {
    return JSON.stringify(this.world.serialize());
  }

  importJson(json: string): void {
    this.world.load(JSON.parse(json) as { tiles: number[]; heights: number[] });
    this.commit();
  }

  reset(): void {
    this.world.load({ tiles: new Array(400).fill(0), heights: new Array(400).fill(0) });
    this.seedDemoPattern();
    this.commit();
  }

  commit(): void {
    localStorage.setItem(STORAGE_KEY, this.exportJson());
    this.notify();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  /** First-launch showcase: stepped terraces, cliff platforms, a rock mass with a door, a pillar, a pit. */
  private seedDemoPattern(): void {
    // Stepped L-terrace (z1 apron, z2 core) — sub-threshold steps stay faceless.
    for (let y = 3; y <= 8; y++) for (let x = 2; x <= 7; x++) this.world.setCell(x, y, TILE.Floor, 1);
    for (let y = 3; y <= 5; y++) for (let x = 4; x <= 7; x++) this.world.setCell(x, y, TILE.Floor, 2);
    // A z2 platform and a z4 block on open ground — stacked south faces + truncation fade.
    for (let y = 3; y <= 5; y++) for (let x = 10; x <= 12; x++) this.world.setCell(x, y, TILE.Floor, 2);
    for (let y = 3; y <= 5; y++) for (let x = 15; x <= 17; x++) this.world.setCell(x, y, TILE.Floor, 4);
    for (let y = 12; y <= 15; y++) for (let x = 11; x <= 16; x++) this.world.setCell(x, y, TILE.Wall, 1);
    this.world.setCell(13, 15, TILE.DoorSafeRoom, 1);
    this.world.setCell(4, 14, TILE.Wall, 1);
    for (let y = 10; y <= 12; y++) for (let x = 2; x <= 4; x++) this.world.setCell(x, y, TILE.Floor, -1);
  }
}
