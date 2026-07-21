// A hand-painted 20x20 world satisfying the terrain renderer's read surface — the
// editor's model. Cells are @dc2d/engine's StackTile (the stack lane's contract:
// walls/cap/stair/feature), always reduced to the engine's (tile, height) pair through
// stacksToHeightField — the single source of truth this file never re-derives. Outside
// the grid reads as chasm void, so the painted map renders as an island. Also owns the
// editor's own torch overlay: tile positions serialized alongside the stacks, additive
// so older saves without a "torches" field still load.
import {
  DEFAULT_FLOOR_CAP,
  STACK_FEATURE,
  TILE,
  ZONE,
  loadEditorMap,
  stacksToHeightField,
  type CompiledField,
  type EditorMapV2,
  type StackDir,
  type StackTile,
  type TileType,
  type TorchTile,
  type ZoneType,
} from "@dc2d/engine";
import { stackFromRaw } from "./stackFromRaw.js";

export const EDITOR_GRID_SIZE = 20;
const VOID_HEIGHT = -4;
const CELL_COUNT = EDITOR_GRID_SIZE * EDITOR_GRID_SIZE;

/** Bare, unpainted ground — walls=0 WITH a cap, per stacks/compile.ts's contract
 * (capless walls=0 is a real, if unusual, zero-height solid wall, not open ground). */
const GROUND_STACK: StackTile = { walls: 0, cap: DEFAULT_FLOOR_CAP, stair: null };

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
    if (!this.inGrid(wx, wy)) return { tile: TILE.Floor, height: VOID_HEIGHT };
    const i = this.indexOf(wx, wy);
    const c = this.ensureCompiled();
    return { tile: c.tiles[i] as TileType, height: c.height[i] ?? 0 };
  }

  /** Raw escape hatch: stamps an exact (tile, height) pair, bypassing the paint-over
   * vocabulary entirely — used by furniture stamps (CraftingTable/Stash) and tests. */
  setCell(wx: number, wy: number, tile: TileType, height: number): void {
    this.setStack(wx, wy, stackFromRaw(tile, height));
  }

  /** Stacks +1: builds on top of whatever was there, clearing any cap/door/stair — the
   * decreed "paint on an existing wall STACKS +1" vocabulary. */
  paintWallAt(wx: number, wy: number): void {
    const s = this.stackAt(wx, wy);
    this.setStack(wx, wy, { walls: (s.stair ? 0 : s.walls) + 1, cap: null, stair: null });
  }

  /** Stamps one solid wall at an explicit rendered height. This is the terrain-debug
   * tool's direct authoring path: a click always means exactly the height shown in
   * the left panel, not "add another invisible stack and count it mentally." */
  paintWallHeightAt(wx: number, wy: number, height: number): void {
    this.setStack(wx, wy, { walls: height, cap: null, stair: null });
  }

  /** Writes the editor's primary terrain datum: a walkable floor at an exact z height. */
  paintFloorHeightAt(wx: number, wy: number, height: number, capId: string): void {
    this.setStack(wx, wy, { walls: height, cap: capId, stair: null });
  }

  /** Makes this height cell a solid, non-walkable void wall with no floor cap. */
  paintVoidAt(wx: number, wy: number): void {
    this.setStack(wx, wy, { walls: this.heightAt(wx, wy), cap: null, stair: null });
  }

  /** Restores an explicit walkable floor cap at the void cell's existing height. */
  restoreFloorAt(wx: number, wy: number, capId: string): void {
    this.paintFloorHeightAt(wx, wy, this.heightAt(wx, wy), capId);
  }

  /** Raises or lowers one cell in the editor's floor-height field. */
  adjustFloorHeightAt(wx: number, wy: number, delta: number, capId: string): void {
    this.paintFloorHeightAt(wx, wy, this.heightAt(wx, wy) + delta, capId);
  }

  /** Caps an existing wall stack walkable at the same height, or just re-textures bare
   * ground (walls 0) — `capId` is the art lane's floor-variant id (`"<packId>:<index>"`). */
  paintFloorAt(wx: number, wy: number, capId: string): void {
    const s = this.stackAt(wx, wy);
    this.setStack(wx, wy, { walls: s.stair ? 0 : s.walls, cap: capId, stair: null });
  }

  /** A door punches into an existing, uncapped, positive wall stack only — a no-op on
   * bare ground or an already-capped platform. */
  paintDoorAt(wx: number, wy: number): void {
    const s = this.stackAt(wx, wy);
    if (s.stair || s.cap !== null || s.walls <= 0) return;
    this.setStack(wx, wy, { walls: s.walls, cap: null, stair: null, feature: STACK_FEATURE.DoorSafeRoom });
  }

  /** A stair tile carries no authored height of its own — compile.ts's run
   * interpolation derives it from the flanking non-stair anchors at compile time. */
  paintStairsAt(wx: number, wy: number, dir: StackDir): void {
    this.setStack(wx, wy, { walls: 0, cap: null, stair: { dir } });
  }

  /** Pops exactly one layer: a feature (door) or floor cap first (revealing the wall
   * stack beneath, unchanged in height), then one wall layer, then clears to ground. */
  eraseAt(wx: number, wy: number): void {
    const s = this.stackAt(wx, wy);
    if (s.stair) return this.setStack(wx, wy, GROUND_STACK);
    if (s.feature) return this.setStack(wx, wy, { walls: s.walls, cap: null, stair: null });
    if (s.cap !== null) {
      if (s.walls <= 0) return this.setStack(wx, wy, GROUND_STACK); // bare ground: nothing to reveal
      return this.setStack(wx, wy, { walls: s.walls, cap: null, stair: null });
    }
    if (s.walls > 1) return this.setStack(wx, wy, { walls: s.walls - 1, cap: null, stair: null });
    // The last wall layer pops to bare ground, not a capless (solid, invisible)
    // walls=0 wall — that shape is only valid for legacy pit-adjacent imports.
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

  /** Transparent v1 import: `loadEditorMap` (the stack lane's contract) migrates a v1
   * `{tiles,heights[,torches]}` save to v2 stacks via the same mechanical reverse
   * mapping worldgen's output layer uses — lossless, and further painting still
   * stacks correctly on the reconstructed cells. */
  load(data: unknown): void {
    const map = loadEditorMap(data);
    this.stacks =
      map.stacks.length === CELL_COUNT
        ? [...map.stacks]
        : Array.from({ length: CELL_COUNT }, (_, i) => map.stacks[i] ?? GROUND_STACK);
    this.compiled = undefined;
    this.torches.clear();
    for (const t of map.torches ?? []) this.addTorch(t.wx, t.wy);
  }

  // ── TerrainWorld surface ─────────────────────────────────────────

  tileAt(wx: number, wy: number): TileType {
    return this.cellAt(wx, wy).tile;
  }

  heightAt(wx: number, wy: number): number {
    return this.cellAt(wx, wy).height;
  }

  zoneAt(_wx: number, _wy: number): ZoneType {
    return ZONE.None;
  }

  isSanctuary(_wx: number, _wy: number): boolean {
    return false;
  }

  groundAt(x: number, y: number): number {
    return this.heightAt(Math.floor(x), Math.floor(y));
  }

  /** Ramp height iff (x, y) sits on a Stairs tile, else null — see WorldView's
   * doc comment. Like groundAt above, this previews as the tile's own flat
   * scalar height rather than a true ramp (EditableWorld.groundAt doesn't
   * ramp either — a pre-existing preview-fidelity limitation, out of scope
   * here; the compiled/shipped World.stairHeightAt is the ramped version). */
  stairHeightAt(x: number, y: number): number | null {
    const wx = Math.floor(x);
    const wy = Math.floor(y);
    return this.tileAt(wx, wy) === TILE.Stairs ? this.heightAt(wx, wy) : null;
  }

  /** Own-tile face model: collision is pure height + solid furniture — the face IS the raised tile. */
  isWalkable(wx: number, wy: number): boolean {
    const tile = this.tileAt(wx, wy);
    return tile !== TILE.Wall && tile !== TILE.CraftingTable && tile !== TILE.Stash;
  }
}
