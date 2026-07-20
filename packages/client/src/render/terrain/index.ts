// Terrain rendering facade: streams base terrain and row-sorted occluders around
// the camera, and can force a targeted light rebake of already-loaded chunks (a
// placed/expired torch) without touching anything outside its light apron.
import { World } from "@dc2d/engine";
import Phaser from "phaser";
import { buildChunkVisual, destroyChunkVisual, type ChunkVisual } from "./chunkVisual.js";
import { affectedChunkKeys } from "./lightRebake.js";
import { chunkKey, desiredChunks, diffChunks, type ChunkCoord, type ViewRect } from "./streaming.js";
import type { DynamicLightSeed } from "./tileLight.js";
import type { TilePos } from "../lighting/torchPlacement.js";

const LOAD_MARGIN_CHUNKS = 1;
/** Chunk bakes per frame: a whole entering column baked synchronously caused
 * measured 108-192ms hitches on chunk-boundary frames (leak-hunt probe,
 * 2026-07-20). The margin gives queued chunks a full screen of runway. */
const MAX_BAKES_PER_FRAME = 2;
export class TerrainRenderer {
  private readonly visuals = new Map<string, ChunkVisual>();
  private readonly bakeQueue: ChunkCoord[] = [];
  /** Live (non-authored) light sources — placed thrown torches — fed into every
   * chunk bake from here on, including chunks that stream in later. */
  private dynamicLights: readonly DynamicLightSeed[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {}

  /** Streams chunks around a view rect: queues what entered the margin (baking at
   * most MAX_BAKES_PER_FRAME per call), culls what left it. */
  update(view: ViewRect): void {
    const desired = desiredChunks(view, LOAD_MARGIN_CHUNKS);
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set(this.visuals.keys()));
    for (const coord of toLoad) {
      const key = chunkKey(coord);
      if (!this.bakeQueue.some((c) => chunkKey(c) === key)) this.bakeQueue.push(coord);
    }
    for (const key of toUnloadKeys) this.unload(key);
    // Drop queued bakes for chunks that scrolled back out before their turn.
    const desiredKeys = new Set(desired.map(chunkKey));
    let baked = 0;
    while (this.bakeQueue.length > 0 && baked < MAX_BAKES_PER_FRAME) {
      const coord = this.bakeQueue.shift()!;
      if (!desiredKeys.has(chunkKey(coord))) continue;
      this.load(coord);
      baked++;
    }
  }

  /** Sets this frame's live light sources — call before update()/rebuildAffected() so
   * both the streaming path and a forced rebake bake against the current set. */
  setDynamicLights(lights: readonly DynamicLightSeed[]): void {
    this.dynamicLights = lights;
  }

  /**
   * Forces a fresh bake of every currently-loaded chunk within `tiles`' light apron —
   * the one-time rebake a torch landing, expiring, or being picked up triggers.
   * Chunks not yet streamed in need no action: they'll bake correctly against the
   * current dynamicLights the moment they load.
   */
  rebuildAffected(tiles: readonly TilePos[]): void {
    for (const key of affectedChunkKeys(tiles)) {
      if (!this.visuals.has(key)) continue;
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      this.load({ cx, cy });
    }
  }

  private load(coord: ChunkCoord): void {
    const key = chunkKey(coord);
    const existing = this.visuals.get(key);
    if (existing) destroyChunkVisual(existing);
    const visual = buildChunkVisual(this.scene, this.world, coord.cx, coord.cy, this.dynamicLights);
    this.visuals.set(key, visual);
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
