// A hand-painted 20x20 world satisfying the terrain renderer's read surface —
// the editor's model. Outside the grid reads as chasm void, so the painted map
// renders as an island and its south edges cast faces into the abyss.
import { TILE, WALL_FACE_MIN_DROP, ZONE, type TileType, type WallFace, type ZoneType } from "@dc2d/engine";

export const EDITOR_GRID_SIZE = 20;
const VOID_HEIGHT = -4;

const DOOR_TILES: ReadonlySet<number> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

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

  /**
   * Mirrors the engine's span-generalized facade contract: ANY higher non-door
   * surface up to 3 rows north projects face rows south; each spanned cell
   * reports the same source with its own bottom.
   */
  wallFaceAt(wx: number, wy: number): WallFace | null {
    const tile = this.tileAt(wx, wy);
    if (DOOR_TILES.has(tile) || tile === TILE.Wall) return null;
    const bottom = this.heightAt(wx, wy);
    for (let k = 1; k <= 3; k++) {
      const sourceY = wy - k;
      const sourceTile = this.tileAt(wx, sourceY);
      if (DOOR_TILES.has(sourceTile)) return null;
      const top = this.heightAt(wx, sourceY);
      const drop = top - bottom;
      if (drop >= WALL_FACE_MIN_DROP) {
        const span = Math.min(Math.max(1, Math.round(drop)), 3);
        return k <= span ? { sourceX: wx, sourceY, bottom, top, span } : null;
      }
      if (top > bottom + 0.01) return null;
    }
    return null;
  }

  isWalkable(wx: number, wy: number): boolean {
    const tile = this.tileAt(wx, wy);
    if (tile === TILE.CraftingTable || tile === TILE.Stash) return false;
    return this.wallFaceAt(wx, wy) === null;
  }
}
