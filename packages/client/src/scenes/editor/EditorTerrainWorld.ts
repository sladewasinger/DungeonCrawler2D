import {
  FEATURE_FACE,
  floorBiomeAt,
  TERRAIN,
  TILE,
  type FeatureFace,
  type FloorBounds,
  type GeneratedFloor,
  type TerrainType,
  type TileType,
} from "@dc2d/engine";
import { editorMapCells, parseEditorMap, serializeEditorMap, validateEditorMap } from "./editorMapFile.js";
import { paintEditorCell, placeEditorStair } from "./editorTerrainTools.js";

export const EDITOR_TOOLS = {
  Height: "height", Floor: "floor", Wall: "wall", Door: "door", Stairs: "stairs",
  Safe: "safe", Spawn: "spawn", Arena: "arena", Feature: "feature",
} as const;
export type EditorTool = (typeof EDITOR_TOOLS)[keyof typeof EDITOR_TOOLS];
export type EditorFixture = "safe" | "spawn" | "arena" | "feature";

export interface EditorCell {
  readonly tile: TileType;
  readonly height: number;
  readonly fixture?: EditorFixture;
}

export interface EditorPoint {
  readonly x: number;
  readonly y: number;
}

/** Finite floor data is authoritative; edits remain a small local overlay. */
export class EditorTerrainWorld {
  readonly features: { readonly voidTerrain: boolean };
  readonly generatedFloor: GeneratedFloor;
  private readonly cells = new Map<string, EditorCell>();
  private editRevision = 0;

  constructor(generatedFloor: GeneratedFloor) {
    this.generatedFloor = generatedFloor;
    this.features = Object.freeze({ voidTerrain: generatedFloor.voidTerrain });
  }

  get worldSeed(): number { return this.generatedFloor.worldSeed; }
  get floor(): number { return this.generatedFloor.floor; }
  get floorBounds(): FloorBounds { return this.generatedFloor.bounds; }
  get stairTreadCount(): number { return this.generatedFloor.configuration.stairTreadCount; }
  get tileRevision(): number { return this.editRevision; }

  terrainAt(x: number, y: number): TerrainType {
    return (this.contains({ x, y }) ? this.generatedFloor.terrain[this.index(x, y)] ?? TERRAIN.Void : TERRAIN.Void) as TerrainType;
  }

  tileAt(x: number, y: number): TileType { return this.cellAt(x, y).tile; }

  surfaceTileAt(x: number, y: number): TileType { return this.tileAt(x, y); }

  featureAt(x: number, y: number): TileType {
    const cell = this.cells.get(this.key(x, y));
    return cell ? cell.tile : this.baseFeature(x, y);
  }

  fixtureAt(x: number, y: number): EditorFixture | null {
    return this.cells.get(this.key(x, y))?.fixture ?? null;
  }

  editedCells(): readonly { readonly point: EditorPoint; readonly fixture?: EditorFixture }[] {
    return [...this.cells.entries()].map(([key, cell]) => {
      const [x, y] = key.split(",").map(Number);
      if (x === undefined || y === undefined) throw new Error("Editor cell key is invalid");
      return { point: { x, y }, ...(cell.fixture ? { fixture: cell.fixture } : {}) };
    });
  }

  featureFaceAt(x: number, y: number): FeatureFace {
    return this.cells.has(this.key(x, y)) ? FEATURE_FACE.Top : this.baseFeatureFace(x, y);
  }

  featureHeightAt(x: number, y: number): number {
    const cell = this.cells.get(this.key(x, y));
    return cell ? (cell.tile === TILE.Stairs ? cell.height : 0) : this.baseFeatureHeight(x, y);
  }

  heightAt(x: number, y: number): number { return this.cellAt(x, y).height; }

  territoryAtWorldTile(x: number, y: number): number | null {
    return this.contains({ x, y }) ? this.generatedFloor.territory[this.index(x, y)] ?? null : null;
  }

  biomeAtWorldTile(x: number, y: number) {
    return floorBiomeAt(this.generatedFloor, x, y);
  }

  contains(point: EditorPoint): boolean {
    const bounds = this.floorBounds;
    return point.x >= bounds.minX && point.x <= bounds.maxX &&
      point.y >= bounds.minY && point.y <= bounds.maxY;
  }

  raiseAt(x: number, y: number): void {
    this.adjustHeight(x, y, 1);
  }

  lowerAt(x: number, y: number): void {
    this.adjustHeight(x, y, -1);
  }

  adjustHeight(x: number, y: number, delta: -1 | 1): void {
    if (!this.isEditable(x, y)) return;
    const current = this.cellAt(x, y);
    this.setCell(x, y, { ...current, height: Math.max(0, current.height + delta) });
  }

  paintAt(x: number, y: number, tool: Exclude<EditorTool, "height">): void {
    if (!this.isEditable(x, y)) return;
    const height = this.heightAt(x, y);
    const cell = paintEditorCell(tool, height);
    this.setCell(x, y, cell);
  }

  placeStair(request: { readonly start: EditorPoint; readonly destination: EditorPoint }): boolean {
    return placeEditorStair(this, request);
  }

  exportMap(): string {
    return serializeEditorMap(this, this.cells);
  }

  importMap(serialized: string): void {
    const data = parseEditorMap(serialized);
    validateEditorMap(data, this);
    this.cells.clear();
    for (const [key, cell] of editorMapCells(data)) this.cells.set(key, cell);
    this.editRevision++;
  }

  reset(): void {
    this.cells.clear();
    this.editRevision++;
  }

  private isEditable(x: number, y: number): boolean {
    return this.contains({ x, y }) && this.terrainAt(x, y) === TERRAIN.Floor;
  }

  isEditablePoint(point: EditorPoint): boolean { return this.isEditable(point.x, point.y); }

  setEditedCell(x: number, y: number, cell: EditorCell): void { this.setCell(x, y, cell); }

  private cellAt(x: number, y: number): EditorCell {
    return this.cells.get(this.key(x, y)) ?? {
      tile: this.baseTile(x, y),
      height: this.baseHeight(x, y),
    };
  }

  private setCell(x: number, y: number, cell: EditorCell): void {
    if (!this.contains({ x, y })) return;
    this.cells.set(this.key(x, y), cell);
    this.editRevision++;
  }

  private baseTile(x: number, y: number): TileType {
    return (this.contains({ x, y }) ? this.generatedFloor.tiles[this.index(x, y)] ?? TILE.Void : TILE.Void) as TileType;
  }

  private baseHeight(x: number, y: number): number {
    return this.contains({ x, y }) ? this.generatedFloor.height[this.index(x, y)] ?? 0 : 0;
  }

  private baseFeature(x: number, y: number): TileType {
    return (this.contains({ x, y }) ? this.generatedFloor.features[this.index(x, y)] ?? TILE.Floor : TILE.Void) as TileType;
  }

  private baseFeatureFace(x: number, y: number): FeatureFace {
    return (this.contains({ x, y }) ? this.generatedFloor.featureFaces[this.index(x, y)] ?? FEATURE_FACE.Top : FEATURE_FACE.Top) as FeatureFace;
  }

  private baseFeatureHeight(x: number, y: number): number {
    return this.contains({ x, y }) ? this.generatedFloor.featureHeight[this.index(x, y)] ?? 0 : 0;
  }

  private index(x: number, y: number): number {
    return (y - this.floorBounds.minY) * this.floorBounds.width + x - this.floorBounds.minX;
  }

  private key(x: number, y: number): string { return `${x},${y}`; }
}
