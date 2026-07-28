import { TERRAIN, TILE, type TerrainType, type TileType } from "@dc2d/engine";

export const EDITOR_GRID_SIZE = 20;

interface EditorCell {
  readonly tile: TileType;
  readonly height: number;
}

export class EditorTerrainWorld {
  private readonly cells = new Map<string, EditorCell>();
  readonly features = { voidTerrain: true } as const;
  tileRevision = 0;

  terrainAt(x: number, y: number): TerrainType {
    return this.inBounds(x, y) ? TERRAIN.Floor : TERRAIN.Void;
  }

  tileAt(x: number, y: number): TileType {
    return this.cellAt(x, y).tile;
  }

  heightAt(x: number, y: number): number {
    return this.cellAt(x, y).height;
  }

  raiseAt(x: number, y: number): void {
    this.setCell(x, y, { tile: TILE.Floor, height: this.heightAt(x, y) + 1 });
  }

  lowerAt(x: number, y: number): void {
    this.setCell(x, y, { tile: TILE.Floor, height: Math.max(0, this.heightAt(x, y) - 1) });
  }

  placeStair(request: { readonly start: EditorPoint; readonly destination: EditorPoint }): boolean {
    const { start, destination } = request;
    if (!areCardinalNeighbors(start, destination)) return false;
    const startHeight = this.heightAt(start.x, start.y);
    const destinationHeight = Math.max(startHeight + 1, this.heightAt(destination.x, destination.y));
    this.setCell(start.x, start.y, { tile: TILE.Stairs, height: (startHeight + destinationHeight) / 2 });
    this.setCell(destination.x, destination.y, { tile: TILE.Floor, height: destinationHeight });
    return true;
  }

  reset(): void {
    this.cells.clear();
    this.tileRevision++;
  }

  private cellAt(x: number, y: number): EditorCell {
    if (!this.inBounds(x, y)) return { tile: TILE.Void, height: 0 };
    return this.cells.get(this.key(x, y)) ?? { tile: TILE.Floor, height: 0 };
  }

  private setCell(x: number, y: number, cell: EditorCell): void {
    if (!this.inBounds(x, y)) return;
    this.cells.set(this.key(x, y), cell);
    this.tileRevision++;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < EDITOR_GRID_SIZE && y < EDITOR_GRID_SIZE;
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}

export interface EditorPoint {
  readonly x: number;
  readonly y: number;
}

function areCardinalNeighbors(first: EditorPoint, second: EditorPoint): boolean {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1;
}
