// The editor's single mutable home: the painted world, the active brush, and change
// notification. Persists to localStorage on every stroke and starts blank so each
// renderer repro contains only deliberately painted cells. Also owns the
// effects test bench (Epic 7.11): area/enemy/item brushes paint straight into
// bench/index.ts's live sim, which SIMULATE ticks separately from the terrain canvas.
//
// Explicit-heights reskin: "no more z buttons" — the terrain brushes are floor/wall/
// stairs/door/torch/erase, each dispatching straight to EditableWorld's paint-over
// methods (@dc2d/engine's stack facade owns the actual compile-to-height semantics).
import { DEFAULT_FLOOR_CAP, type StackDir } from "@dc2d/engine";
import { getViewOrientation, rotateOrientation, setViewOrientation } from "../../render/view/index.js";
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
import { AutotileMaskCache } from "./autotileMaskCache.js";
import { EditableWorld, EDITOR_GRID_SIZE } from "./EditableWorld.js";

const STORAGE_KEY = "dc2d-editor-map-v2";

export type Brush =
  | { readonly kind: "floor"; readonly capId: string; readonly height?: number }
  | { readonly kind: "void" }
  | { readonly kind: "wall"; readonly height?: number }
  | { readonly kind: "stairs"; readonly direction: StackDir }
  | { readonly kind: "door" }
  | { readonly kind: "torch" }
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

export class EditorStore {
  readonly world = new EditableWorld();
  readonly bench: BenchState;
  /** Live bitmask autotile solve for the grid inspector's hex readout + the AUTOTILE
   * DEBUG overlay — kept fresh incrementally (paint stroke -> resolveAround), rebuilt
   * whole only on load/import/reset. */
  readonly autotileMasks = new AutotileMaskCache();
  brush: Brush = { kind: "floor", capId: DEFAULT_FLOOR_CAP, height: 0 };
  showCollision = false;
  showAutotileDebug = false;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.bench = createBench(this.world);
    this.loadOrSeed();
    this.autotileMasks.rebuildAll(this.world, EDITOR_GRID_SIZE);
  }

  private loadOrSeed(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.world.load(JSON.parse(saved));
        return;
      } catch {
      // Corrupt save: fall through to the blank map.
      }
    }
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
    if (brush.kind === "wall") {
      if (brush.height === undefined) this.world.paintWallAt(wx, wy);
      else this.world.paintWallHeightAt(wx, wy, brush.height);
    }
    else if (brush.kind === "void") this.world.paintVoidAt(wx, wy);
    else if (brush.kind === "floor") {
      if (brush.height === undefined) this.world.paintFloorAt(wx, wy, brush.capId);
      else this.world.paintFloorHeightAt(wx, wy, brush.height, brush.capId);
    }
    else if (brush.kind === "stairs") this.world.paintStairsAt(wx, wy, brush.direction);
    else if (brush.kind === "door") this.world.paintDoorAt(wx, wy);
    else if (brush.kind === "erase") this.world.eraseAt(wx, wy);
    else if (brush.kind === "torch") this.world.addTorch(wx, wy);
    // A terrain brush can only ever change wall-adjacency for the painted cell and its
    // 8 neighbors — the live re-solve this lane asks for, never a full-map recompute.
    if (brush.kind !== "torch") this.autotileMasks.resolveAround(this.world, wx, wy);
  }

  /** Right-click erase for the bench layer the active brush belongs to; a no-op for
   * terrain brushes (those already have their own eraser brush). */
  eraseBenchAt(wx: number, wy: number): void {
    const layer = benchLayerOf(this.brush);
    if (layer) eraseBenchCell(this.bench, wx, wy, layer);
  }

  /** Right-click erase for the torch brush — removes a stamped light source and
   * persists the change, mirroring eraseBenchAt's contract for bench layers. */
  eraseTorchAt(wx: number, wy: number): void {
    this.world.removeTorch(wx, wy);
    this.commit();
  }

  toggleSimulate(): void {
    toggleBenchSimulate(this.bench);
  }

  resetBench(): void {
    resetBenchState(this.bench);
  }

  toggleCollision(): void {
    this.showCollision = !this.showCollision;
    this.notify();
  }

  toggleAutotileDebug(): void {
    this.showAutotileDebug = !this.showAutotileDebug;
    this.notify();
  }

  /** LANE W3 (editor rotation): steps the seam's live ViewOrientation one 90-degree
   * increment (1 = clockwise, -1 = counter-clockwise, same `dir` convention as the
   * game's Q/X rotation) and notifies — the render panel (EditorScene) is already
   * subscribed via onChange, so this alone triggers its rebuild/re-frame. The data grid
   * (paintPanel) never subscribes to this notification: it stays north-fixed on purpose. */
  rotateView(dir: 1 | -1): void {
    setViewOrientation(rotateOrientation(getViewOrientation(), dir));
    this.notify();
  }

  /** Re-renders without touching persisted map data — the lighting panel calls this
   * after adjusting tileLight.ts's module-level config, so the live bake picks up the
   * new tuning without writing a spurious localStorage save. */
  notifyLightingChange(): void {
    this.notify();
  }

  exportJson(): string {
    return JSON.stringify(this.world.serialize());
  }

  importJson(json: string): void {
    this.world.load(JSON.parse(json));
    this.autotileMasks.rebuildAll(this.world, EDITOR_GRID_SIZE);
    this.commit();
  }

  reset(): void {
    this.world.clear();
    this.autotileMasks.rebuildAll(this.world, EDITOR_GRID_SIZE);
    this.commit();
  }

  restoreVoidAt(wx: number, wy: number): void {
    this.world.restoreFloorAt(wx, wy, DEFAULT_FLOOR_CAP);
    this.autotileMasks.resolveAround(this.world, wx, wy);
    this.commit();
  }

  adjustFloorHeight(wx: number, wy: number, delta: number): void {
    if (!this.world.inGrid(wx, wy)) return;
    this.world.adjustFloorHeightAt(wx, wy, delta, DEFAULT_FLOOR_CAP);
    this.autotileMasks.resolveAround(this.world, wx, wy);
    this.commit();
  }

  commit(): void {
    localStorage.setItem(STORAGE_KEY, this.exportJson());
    this.notify();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}
