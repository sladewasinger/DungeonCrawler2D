// A hand-painted 20x20 world satisfying the terrain renderer's read surface — the
// editor's model. Cells are @dc2d/engine's StackTile (the stack lane's contract:
// height/cap/stair/feature), always reduced to the engine's (tile, height) pair through
// stacksToHeightField — the single source of truth this file never re-derives. Outside
// the grid reads as chasm void, so the painted map renders as an island. Also owns the
// editor's own torch overlay: tile positions serialized alongside the stacks, additive
// so older saves without a "torches" field still load.
import {
  DEFAULT_FLOOR_CAP,
  STACK_FEATURE,
  TERRAIN,
  TILE,
  ZONE,
  editorMapV2Schema,
  stairRampAt,
  stacksToHeightField,
  type CompiledField,
  type EditorMapV2,
  type StackDir,
  type StackTile,
  type TerrainType,
  type TileType,
  type TorchTile,
  type ZoneType,
} from "@dc2d/engine";
import { stackFromRaw } from "./stackFromRaw.js";
import {
  planStairPlacement,
  type StairPlacementPlan,
  type StairPlacementPoint,
} from "./stairPlacement.js";

export const EDITOR_GRID_SIZE = 20;
const CELL_COUNT = EDITOR_GRID_SIZE * EDITOR_GRID_SIZE;
/** Bare, unpainted ground — a finite Floor at height 0 with the default cap. */
const GROUND_STACK: StackTile = { height: 0, cap: DEFAULT_FLOOR_CAP, stair: null };

export interface EditorCell {
  readonly tile: TileType;
  readonly height: number;
}
export type { TorchTile };

export class EditableWorld {
  private stacks: StackTile[] = new Array(CELL_COUNT).fill(GROUND_STACK);
  private readonly torches = new Set<string>();
  private compiled: CompiledField | undefined;

  inGrid(wx: number, wy: number): boolean {
    return wx >= 0 && wy >= 0 && wx < EDITOR_GRID_SIZE && wy < EDITOR_GRID_SIZE;
  }

  private indexOf(wx: number, wy: number): number {
    return wy * EDITOR_GRID_SIZE + wx;
  }

  stackAt(wx: number, wy: number): StackTile {
    return this.inGrid(wx, wy) ? (this.stacks[this.indexOf(wx, wy)] ?? GROUND_STACK) : GROUND_STACK;
  }

  private setStack(wx: number, wy: number, stack: StackTile): void {
    if (!this.inGrid(wx, wy)) return;
    this.stacks[this.indexOf(wx, wy)] = stack;
    this.compiled = undefined; // invalidated; stair-run interpolation needs a whole-grid recompile anyway
  }
  private ensureCompiled(): CompiledField {
    if (!this.compiled) this.compiled = stacksToHeightField(this.stacks, EDITOR_GRID_SIZE, EDITOR_GRID_SIZE);
    return this.compiled;
  }

  cellAt(wx: number, wy: number): EditorCell {
    if (!this.inGrid(wx, wy)) return { tile: TILE.Void, height: 0 };
    const i = this.indexOf(wx, wy);
    const c = this.ensureCompiled();
    return { tile: c.tiles[i] as TileType, height: c.height[i] ?? 0 };
  }

  /** Raw escape hatch: stamps an exact (tile, height) pair, bypassing the paint-over
   * vocabulary entirely — used by furniture stamps (CraftingTable/Stash) and tests. */
  setCell(wx: number, wy: number, tile: TileType, height: number): void {
    this.setStack(wx, wy, stackFromRaw(tile, height));
  }

  /** Raises the finite floor height by one, clearing any feature or stair override. */
  paintHeightAt(wx: number, wy: number): void {
    const s = this.stackAt(wx, wy);
    this.setStack(wx, wy, {
      height: (s.stair ? 0 : s.height) + 1,
      cap: s.cap ?? DEFAULT_FLOOR_CAP,
      stair: null,
    });
  }

  /** Writes the editor's primary terrain datum: a walkable floor at an exact z height. */
  paintFloorHeightAt(wx: number, wy: number, height: number, capId: string): void {
    this.setStack(wx, wy, { height: height, cap: capId, stair: null });
  }

  /** Makes this cell an empty, non-walkable void with no finite floor cap. */
  paintVoidAt(wx: number, wy: number): void {
    this.setStack(wx, wy, { height: this.heightAt(wx, wy), cap: null, stair: null });
  }

  /** Restores an explicit walkable floor cap at the void cell's existing height. */
  restoreFloorAt(wx: number, wy: number, capId: string): void {
    this.paintFloorHeightAt(wx, wy, this.heightAt(wx, wy), capId);
  }

  /** Raises or lowers one cell in the editor's floor-height field. */
  adjustFloorHeightAt(wx: number, wy: number, delta: number, capId: string): void {
    this.paintFloorHeightAt(wx, wy, this.heightAt(wx, wy) + delta, capId);
  }

  /** Applies a floor art cap while preserving the authored finite height. */
  paintFloorAt(wx: number, wy: number, capId: string): void {
    const s = this.stackAt(wx, wy);
    this.setStack(wx, wy, { height: s.stair ? 0 : s.height, cap: capId, stair: null });
  }

  /** Adds a door feature to a raised finite floor. */
  paintDoorAt(wx: number, wy: number): void {
    const s = this.stackAt(wx, wy);
    if (s.stair || s.height <= 0 || s.cap === null) return;
    this.setStack(wx, wy, {
      height: s.height,
      cap: s.cap,
      stair: null,
      feature: STACK_FEATURE.DoorSafeRoom,
    });
  }

  /** A stair tile carries no authored height of its own — compile.ts's run
   * interpolation derives it from the flanking non-stair anchors at compile time. */
  paintStairsAt(wx: number, wy: number, dir: StackDir): void {
    this.setStack(wx, wy, { height: 0, cap: null, stair: { dir } });
  }

  placeStairTransition(
    stair: StairPlacementPoint,
    destination: StairPlacementPoint,
  ): StairPlacementPlan | null {
    const plan = planStairPlacement(this, stair, destination);
    if (!plan) return null;
    const originCap = this.stackAt(plan.originLanding.x, plan.originLanding.y).cap ?? DEFAULT_FLOOR_CAP;
    const destinationCap = this.stackAt(destination.x, destination.y).cap ?? DEFAULT_FLOOR_CAP;
    this.paintFloorHeightAt(
      plan.originLanding.x,
      plan.originLanding.y,
      plan.originHeight,
      originCap,
    );
    this.paintFloorHeightAt(
      destination.x,
      destination.y,
      plan.destinationHeight,
      destinationCap,
    );
    this.paintStairsAt(stair.x, stair.y, plan.stairDirection);
    return plan;
  }

  /** Removes a feature/cap, then lowers the finite floor height one step at a time. */
  eraseAt(wx: number, wy: number): void {
    const s = this.stackAt(wx, wy);
    if (s.stair) return this.setStack(wx, wy, GROUND_STACK);
    if (s.feature) return this.setStack(wx, wy, { height: s.height, cap: s.cap ?? DEFAULT_FLOOR_CAP, stair: null });
    if (s.cap === null) return this.setStack(wx, wy, GROUND_STACK);
    if (s.height > 0) return this.setStack(wx, wy, { height: s.height - 1, cap: s.cap, stair: null });
    this.setStack(wx, wy, GROUND_STACK);
  }

  /** Restores the authored terrain and editor-only torch layer to a genuinely blank map. */
  clear(): void {
    this.stacks = new Array(CELL_COUNT).fill(GROUND_STACK);
    this.torches.clear();
    this.compiled = undefined;
  }

  // ── torch overlay (editor-only light sources) ───────────────────

  private torchKey(wx: number, wy: number): string {
    return `${wx},${wy}`;
  }

  addTorch(wx: number, wy: number): void {
    if (!this.inGrid(wx, wy)) return;
    this.torches.add(this.torchKey(wx, wy));
  }

  removeTorch(wx: number, wy: number): void {
    this.torches.delete(this.torchKey(wx, wy));
  }

  hasTorch(wx: number, wy: number): boolean {
    return this.torches.has(this.torchKey(wx, wy));
  }

  /** Every stamped torch, in the shape `computeLightField`'s dynamic-seed callers want
   * (see EditorScene.ts, which maps these to full-strength `DynamicLightSeed`s). */
  torchPositions(): TorchTile[] {
    return [...this.torches].map((key) => {
      const [wx, wy] = key.split(",").map(Number) as [number, number];
      return { wx, wy };
    });
  }

  serialize(): EditorMapV2 {
    return {
      version: 2,
      width: EDITOR_GRID_SIZE,
      rows: EDITOR_GRID_SIZE,
      stacks: [...this.stacks],
      torches: this.torchPositions(),
    };
  }

  /** Loads the current editor-map format. Old flat tile/height saves are intentionally
   * rejected: the project has no persisted worlds that need a compatibility path. */
  load(data: unknown): void {
    const map = editorMapV2Schema.parse(data);
    this.stacks =
      map.stacks.length === CELL_COUNT
        ? [...map.stacks]
        : Array.from({ length: CELL_COUNT }, (_, i) => map.stacks[i] ?? GROUND_STACK);
    this.compiled = undefined;
    this.torches.clear();
    for (const t of map.torches ?? []) this.addTorch(t.wx, t.wy);
  }

  tileAt(wx: number, wy: number): TileType {
    return this.cellAt(wx, wy).tile;
  }

  heightAt(wx: number, wy: number): number {
    return this.cellAt(wx, wy).height;
  }

  zoneAt(wx: number, wy: number): ZoneType { void wx; void wy; return ZONE.None; }

  isSanctuary(wx: number, wy: number): boolean { void wx; void wy; return false; }

  terrainAt(wx: number, wy: number): TerrainType {
    return this.tileAt(wx, wy) === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
  }

  groundAt(x: number, y: number): number {
    return stairRampAt(this, x, y) ?? this.heightAt(Math.floor(x), Math.floor(y));
  }

  /** Ramp height iff (x, y) sits on a Stairs tile, matching live World exactly. */
  stairHeightAt(x: number, y: number): number | null {
    const wx = Math.floor(x);
    const wy = Math.floor(y);
    if (this.tileAt(wx, wy) !== TILE.Stairs) return null;
    return stairRampAt(this, x, y);
  }

  isWalkable(wx: number, wy: number): boolean {
    const tile = this.tileAt(wx, wy); return tile !== TILE.Void && tile !== TILE.CraftingTable && tile !== TILE.Stash;
  }
}
