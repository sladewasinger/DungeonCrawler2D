// The editor's single mutable home: the painted world, the active brush, and
// change notification. Persists to localStorage on every stroke; seeds a demo
// pattern on first launch so the renderer has something to prove immediately.
// Also owns the effects test bench (Epic 7.11): area/enemy/item brushes paint
// straight into bench/index.ts's live sim, which SIMULATE ticks separately from
// the terrain canvas below.
import { TILE, type TileType } from "@dc2d/engine";
import {
  createBench,
  eraseBenchCell,
  paintArea,
  paintEnemy,
  paintItem,
  resetBench as resetBenchState,
  toggleSimulate as toggleBenchSimulate,
  type BenchLayer,
  type BenchState,
} from "./bench/index.js";
import { EditableWorld } from "./EditableWorld.js";

const STORAGE_KEY = "dc2d-editor-map-v1";

export type Brush =
  | { readonly kind: "height"; readonly value: number }
  | { readonly kind: "rock" }
  | { readonly kind: "door" }
  | { readonly kind: "erase" }
  | { readonly kind: "area"; readonly areaId: string }
  | { readonly kind: "spawn-enemy"; readonly defId: string }
  | { readonly kind: "spawn-item"; readonly defId: string };

/** The bench layer a brush paints into, or null for a terrain brush. */
function benchLayerOf(brush: Brush): BenchLayer | null {
  if (brush.kind === "area") return "area";
  if (brush.kind === "spawn-enemy") return "enemy";
  if (brush.kind === "spawn-item") return "item";
  return null;
}

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
  readonly bench: BenchState;
  brush: Brush = { kind: "height", value: 1 };
  showCollision = false;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.bench = createBench(this.world);
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
    if (brush.kind === "area") return paintArea(this.bench, wx, wy, brush.areaId);
    if (brush.kind === "spawn-enemy") return paintEnemy(this.bench, wx, wy, brush.defId);
    if (brush.kind === "spawn-item") return paintItem(this.bench, wx, wy, brush.defId);
    this.paintTerrain(wx, wy, brush);
    this.commit();
  }

  private paintTerrain(wx: number, wy: number, brush: Brush): void {
    if (brush.kind === "height") this.world.setCell(wx, wy, TILE.Floor, brush.value);
    else if (brush.kind === "erase") this.world.setCell(wx, wy, TILE.Floor, 0);
    else if (brush.kind === "rock") {
      this.world.setCell(wx, wy, TILE.Wall, rockHeightAround(this.world, wx, wy));
    } else if (brush.kind === "door" && this.world.tileAt(wx, wy) === TILE.Wall) {
      // Door stamps require an existing rock cell: the portal punches INTO a wall.
      this.world.setCell(wx, wy, TILE.DoorSafeRoom, this.world.heightAt(wx, wy));
    }
  }

  /** Right-click erase for the bench layer the active brush belongs to; a no-op for
   * terrain brushes (those already have their own eraser brush). */
  eraseBenchAt(wx: number, wy: number): void {
    const layer = benchLayerOf(this.brush);
    if (layer) eraseBenchCell(this.bench, wx, wy, layer);
  }

  toggleSimulate(): void {
    toggleBenchSimulate(this.bench);
  }

  resetBench(): void {
    resetBenchState(this.bench);
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

  private fillRect(x0: number, y0: number, x1: number, y1: number, tile: TileType, height: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.world.setCell(x, y, tile, height);
  }

  /** First-launch showcase: stepped terraces, cliff platforms, a rock mass with a door, a pillar, a pit. */
  private seedDemoPattern(): void {
    // Stepped L-terrace (z1 apron, z2 core), then a z2 platform and a z4 block on
    // open ground — stacked south faces + truncation fade.
    this.fillRect(2, 3, 7, 8, TILE.Floor, 1);
    this.fillRect(4, 3, 7, 5, TILE.Floor, 2);
    this.fillRect(10, 3, 12, 5, TILE.Floor, 2);
    this.fillRect(15, 3, 17, 5, TILE.Floor, 4);
    this.fillRect(11, 12, 16, 15, TILE.Wall, 1);
    this.world.setCell(13, 15, TILE.DoorSafeRoom, 1);
    this.world.setCell(4, 14, TILE.Wall, 1);
    this.fillRect(2, 10, 4, 12, TILE.Floor, -1);
  }
}
