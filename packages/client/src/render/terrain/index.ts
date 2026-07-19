// Terrain rendering facade: streams base terrain and row-sorted occluders around
// the camera.
import { World } from "@dc2d/engine";
import Phaser from "phaser";
import { buildChunkVisual, destroyChunkVisual, type ChunkVisual } from "./chunkVisual.js";
import { chunkKey, desiredChunks, diffChunks, type ChunkCoord, type ViewRect } from "./streaming.js";

const LOAD_MARGIN_CHUNKS = 1;
export class TerrainRenderer {
  private readonly visuals = new Map<string, ChunkVisual>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {}

  /** Streams chunks around a view rect: loads what entered the margin, culls what left it. */
  update(view: ViewRect): void {
    const desired = desiredChunks(view, LOAD_MARGIN_CHUNKS);
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set(this.visuals.keys()));
    for (const coord of toLoad) this.load(coord);
    for (const key of toUnloadKeys) this.unload(key);
  }

  private load(coord: ChunkCoord): void {
    const visual = buildChunkVisual(this.scene, this.world, coord.cx, coord.cy);
    this.visuals.set(chunkKey(coord), visual);
  }

  private unload(key: string): void {
    const visual = this.visuals.get(key);
    if (!visual) return;
    destroyChunkVisual(visual);
    this.visuals.delete(key);
  }

  /** Chunk visuals currently resident — GPU memory stays flat because this stays bounded by the view margin. */
  get loadedChunkCount(): number {
    return this.visuals.size;
  }

  dispose(): void {
    for (const key of [...this.visuals.keys()]) this.unload(key);
  }
}
