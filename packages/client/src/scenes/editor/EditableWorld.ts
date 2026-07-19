// A hand-painted 20x20 world satisfying the terrain renderer's read surface —
// the editor's model. Outside the grid reads as chasm void, so the painted map
// renders as an island and its south edges cast faces into the abyss.
import { TILE, ZONE, type TileType, type ZoneType } from "@dc2d/engine";

export const EDITOR_GRID_SIZE = 20;
const VOID_HEIGHT = -4;

export interface EditorCell {
  readonly tile: TileType;
  readonly height: number;
}

export class EditableWorld {
  private readonly tiles = new Uint8Array(EDITOR_GRID_SIZE * EDITOR_GRID_SIZE);
  private readonly heights = new Float32Array(EDITOR_GRID_SIZE * EDITOR_GRID_SIZE);

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

  serialize(): { tiles: number[]; heights: number[] } {
    return { tiles: [...this.tiles], heights: [...this.heights] };
  }

  load(data: { tiles: number[]; heights: number[] }): void {
    this.tiles.set(data.tiles.slice(0, this.tiles.length));
    this.heights.set(data.heights.slice(0, this.heights.length));
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
