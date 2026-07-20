// A hand-painted 20x20 world satisfying the terrain renderer's read surface —
// the editor's model. Outside the grid reads as chasm void, so the painted map
// renders as an island and its south edges cast faces into the abyss. Also owns
// the editor's own torch overlay (the lighting workbench's torch brush): a set of
// tile positions serialized alongside tiles/heights, additive to the map JSON so
// older saves without a "torches" field still load cleanly.
import { TILE, ZONE, type TileType, type ZoneType } from "@dc2d/engine";

export const EDITOR_GRID_SIZE = 20;
const VOID_HEIGHT = -4;

export interface EditorCell {
  readonly tile: TileType;
  readonly height: number;
}

export interface TorchTile {
  readonly wx: number;
  readonly wy: number;
}

export interface EditorWorldData {
  readonly tiles: number[];
  readonly heights: number[];
  /** Optional so pre-torch saves (no "torches" key at all) still load. */
  readonly torches?: readonly TorchTile[];
}

export class EditableWorld {
  private readonly tiles = new Uint8Array(EDITOR_GRID_SIZE * EDITOR_GRID_SIZE);
  private readonly heights = new Float32Array(EDITOR_GRID_SIZE * EDITOR_GRID_SIZE);
  private readonly torches = new Set<string>();

  inGrid(wx: number, wy: number): boolean {
    return wx >= 0 && wy >= 0 && wx < EDITOR_GRID_SIZE && wy < EDITOR_GRID_SIZE;
  }

  cellAt(wx: number, wy: number): EditorCell {
    if (!this.inGrid(wx, wy)) return { tile: TILE.Floor, height: VOID_HEIGHT };
    const i = wy * EDITOR_GRID_SIZE + wx;
    return { tile: this.tiles[i] as TileType, height: this.heights[i] ?? 0 };
  }

  setCell(wx: number, wy: number, tile: TileType, height: number): void {
    if (!this.inGrid(wx, wy)) return;
    const i = wy * EDITOR_GRID_SIZE + wx;
    this.tiles[i] = tile;
    this.heights[i] = height;
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

  serialize(): EditorWorldData {
    return { tiles: [...this.tiles], heights: [...this.heights], torches: this.torchPositions() };
  }

  load(data: EditorWorldData): void {
    this.tiles.set(data.tiles.slice(0, this.tiles.length));
    this.heights.set(data.heights.slice(0, this.heights.length));
    this.torches.clear();
    for (const t of data.torches ?? []) this.addTorch(t.wx, t.wy);
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

  /** Own-tile face model: collision is pure height + solid furniture — the face IS the raised tile. */
  isWalkable(wx: number, wy: number): boolean {
    const tile = this.tileAt(wx, wy);
    return tile !== TILE.CraftingTable && tile !== TILE.Stash;
  }
}
