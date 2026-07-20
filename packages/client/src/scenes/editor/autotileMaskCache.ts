// Incremental autotile mask cache for the editor: painting one cell only ever
// invalidates that cell AND its 8 neighbors (the only cells whose own mask could
// possibly have changed), never the whole 20x20 grid — the "live bitmask re-solve"
// the autotile-debug lane asks for. Backs both the grid inspector's hex-on-hover
// readout and the AUTOTILE DEBUG canvas overlay.
import { solveWallAutotile, type WallAutotile } from "../../render/terrain/autotile.js";
import { wallSolidAt } from "../../render/terrain/debugArt.js";
import type { TerrainRead } from "../../render/terrain/faces.js";

/** (self + all 8 neighbors), self first so it always overwrites regardless of iteration order. */
const RESOLVE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
]; // prettier-ignore

export class AutotileMaskCache {
  private readonly masks = new Map<string, WallAutotile>();

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** The last-resolved mask at (x, y), or undefined before the first resolve (e.g. mid-construction). */
  get(x: number, y: number): WallAutotile | undefined {
    return this.masks.get(this.key(x, y));
  }

  private resolveOne(world: TerrainRead, x: number, y: number): void {
    this.masks.set(this.key(x, y), solveWallAutotile(wallSolidAt(world, x, y)));
  }

  /** Recomputes (x, y) and its 8 neighbors only — call after every paint stroke. */
  resolveAround(world: TerrainRead, x: number, y: number): void {
    for (const [dx, dy] of RESOLVE_OFFSETS) this.resolveOne(world, x + dx, y + dy);
  }

  /** Full-grid recompute — construction, import, and reset only; never a paint stroke. */
  rebuildAll(world: TerrainRead, gridSize: number): void {
    this.masks.clear();
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) this.resolveOne(world, x, y);
    }
  }
}
