import { LEVEL, TILE, World, type TerrainType, type TileType, type WorldView } from "@dc2d/engine";
import type { TerrainWorld } from "../../render/terrain/runtime/world.js";

export const CHARACTER_VFX_ROOM = {
  left: 1,
  top: 2,
  width: 34,
  height: 12,
} as const;

const SANDBOX_SEED = 7;
const SANDBOX_FLOOR = 0;
const ROOM_RIGHT = CHARACTER_VFX_ROOM.left + CHARACTER_VFX_ROOM.width;
const ROOM_BOTTOM = CHARACTER_VFX_ROOM.top + CHARACTER_VFX_ROOM.height;

/** Real sandbox World with a deterministic flat tile carve for the VFX stage. */
export class CharacterVfxBenchWorld implements TerrainWorld, WorldView {
  private readonly sandbox = new World(SANDBOX_SEED, SANDBOX_FLOOR, LEVEL.Sandbox);

  constructor() {
    this.sandbox.replaceTileOverrides(flatAreaOverrides());
  }

  get tileRevision(): number {
    return this.sandbox.tileRevision;
  }

  get worldSeed(): number {
    return this.sandbox.worldSeed;
  }

  get floor(): number {
    return this.sandbox.floor;
  }

  get features() {
    return this.sandbox.features;
  }

  terrainAt(x: number, y: number): TerrainType {
    return this.sandbox.terrainAt(x, y);
  }

  tileAt(x: number, y: number): TileType {
    return this.sandbox.tileAt(x, y);
  }

  featureAt(x: number, y: number): TileType {
    return this.sandbox.featureAt(x, y);
  }

  featureFaceAt(x: number, y: number) {
    return this.sandbox.featureFaceAt(x, y);
  }

  featureHeightAt(x: number, y: number): number {
    return this.sandbox.featureHeightAt(x, y);
  }

  heightAt(x: number, y: number): number {
    return inFlatArea(x, y) ? 0 : this.sandbox.heightAt(x, y);
  }

  isWalkable(x: number, y: number): boolean {
    return inFlatArea(x, y) || this.sandbox.isWalkable(x, y);
  }

  groundAt(x: number, y: number): number {
    return inFlatArea(Math.floor(x), Math.floor(y)) ? 0 : this.sandbox.groundAt(x, y);
  }

  stairHeightAt(x: number, y: number): number | null {
    return inFlatArea(Math.floor(x), Math.floor(y)) ? null : this.sandbox.stairHeightAt(x, y);
  }
}

function flatAreaOverrides(): readonly { x: number; y: number; tile: TileType }[] {
  const overrides: { x: number; y: number; tile: TileType }[] = [];
  for (let y = CHARACTER_VFX_ROOM.top; y < ROOM_BOTTOM; y++) {
    for (let x = CHARACTER_VFX_ROOM.left; x < ROOM_RIGHT; x++) {
      overrides.push({ x, y, tile: TILE.Floor });
    }
  }
  return overrides;
}

function inFlatArea(x: number, y: number): boolean {
  return x >= CHARACTER_VFX_ROOM.left && x < ROOM_RIGHT &&
    y >= CHARACTER_VFX_ROOM.top && y < ROOM_BOTTOM;
}
