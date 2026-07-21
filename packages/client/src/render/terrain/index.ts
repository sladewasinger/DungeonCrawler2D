// Terrain rendering facade: streams base terrain and row-sorted occluders around
// the camera, and can force a targeted light rebake of already-loaded chunks (a
// placed/expired torch) without touching anything outside its light apron.
import { World } from "@dc2d/engine";
import Phaser from "phaser";
import { getViewOrientation } from "../view/viewState.js";
import { buildChunkVisual, destroyChunkVisual, type ChunkVisual } from "./chunkVisual.js";
import { affectedChunkKeys } from "./lightRebake.js";
import { chunkKey, desiredChunks, diffChunks, planBakes, type ChunkCoord, type ViewRect } from "./streaming.js";
import type { DynamicLightSeed } from "./tileLight.js";
import type { TilePos } from "../lighting/torchPlacement.js";

const LOAD_MARGIN_CHUNKS = 1;
/** Chunk bakes per frame: a whole entering column baked synchronously caused
 * measured 108-192ms hitches on chunk-boundary frames (leak-hunt probe,
 * 2026-07-20). The margin gives queued chunks a full screen of runway. */
const MAX_BAKES_PER_FRAME = 2;
/** Margin-only (not yet visible) chunks bake slower still — they're off-screen
 * by LOAD_MARGIN_CHUNKS, so appearing a few frames later costs nothing visible
 * while halving the walking-stream bake spike (see streaming.ts's planBakes). */
const MAX_MARGIN_BAKES_PER_FRAME = 1;
export class TerrainRenderer {
  private readonly visuals = new Map<string, ChunkVisual>();
  private readonly bakeQueue: ChunkCoord[] = [];
  /** When set, the next update() drains the ENTIRE bake queue in one frame instead of
   * budgeting MAX_BAKES_PER_FRAME — the camera-rotation snap needs the whole view
   * rebaked the same frame it lands, or the world reads as blinking in chunk-by-chunk
   * over ~6 frames (user playtest). One deliberately heavy frame for a deliberate,
   * rare action; normal streaming stays budgeted. */
  private drainNextUpdate = false;
  /** Live (non-authored) light sources — placed thrown torches — fed into every
   * chunk bake from here on, including chunks that stream in later. */
  private dynamicLights: readonly DynamicLightSeed[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {}

  /** Streams chunks around a view rect: queues what entered the margin, bakes this
   * frame's urgency-tiered picks (planBakes — visible chunks first at
   * MAX_BAKES_PER_FRAME, margin-only at MAX_MARGIN_BAKES_PER_FRAME), culls what
   * left. planBakes also drops queued bakes for chunks that scrolled back out
   * before their turn. */
  update(view: ViewRect): void {
    const desired = desiredChunks(view, LOAD_MARGIN_CHUNKS);
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set(this.visuals.keys()));
    for (const coord of toLoad) {
      const key = chunkKey(coord);
      if (!this.bakeQueue.some((c) => chunkKey(c) === key)) this.bakeQueue.push(coord);
    }
    for (const key of toUnloadKeys) this.unload(key);
    const desiredKeys = new Set(desired.map(chunkKey));
    const viewKeys = new Set(desiredChunks(view, 0).map(chunkKey));
    const drain = this.drainNextUpdate;
    this.drainNextUpdate = false;
    const { bake, keep } = planBakes(
      this.bakeQueue,
      desiredKeys,
      viewKeys,
      drain ? Number.POSITIVE_INFINITY : MAX_BAKES_PER_FRAME,
      drain ? Number.POSITIVE_INFINITY : MAX_MARGIN_BAKES_PER_FRAME,
    );
    this.bakeQueue.length = 0;
    this.bakeQueue.push(...keep);
    for (const coord of bake) this.load(coord);
  }

  /** Invalidates everything AND makes the next update() rebake the whole view in one
   * frame — the rotation-snap path (see drainNextUpdate). */
  rebakeAllNow(): void {
    this.invalidateAll();
    this.drainNextUpdate = true;
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
    for (const key of affectedChunkKeys(tiles, getViewOrientation())) {
      if (!this.visuals.has(key)) continue;
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      this.load({ cx, cy });
    }
  }

  private load(coord: ChunkCoord): void {
    const key = chunkKey(coord);
    const existing = this.visuals.get(key);
    if (existing) destroyChunkVisual(existing);
    // Reads the seam's ViewState fresh per chunk build rather than being handed
    // orientation as a constructor/update param: this lane's orientation is fixed for
    // the whole session (docs/ASSUMPTIONS.md), so every resident chunk is baked at the
    // same value regardless of when it streams in — no live-rotation cache invalidation
    // is needed (or implemented) yet; that's next lane's job once Q/E actually changes it.
    const visual = buildChunkVisual(this.scene, this.world, coord.cx, coord.cy, getViewOrientation(), this.dynamicLights);
    this.visuals.set(key, visual);
  }

  private unload(key: string): void {
    const visual = this.visuals.get(key);
    if (!visual) return;
    destroyChunkVisual(visual);
    this.visuals.delete(key);
  }

  /**
   * Forces every currently-resident chunk to unload — the next update() call re-streams
   * and rebakes each one fresh against whatever getViewOrientation() returns by then. The
   * one-time cost live camera rotation pays (scenes/dungeon/rotationControl.ts's hard
   * swap): chunks are baked per-orientation and never kept in a multi-orientation cache
   * (docs/ASSUMPTIONS.md row 258's chunk-bake cache-policy decision).
   */
  invalidateAll(): void {
    for (const key of [...this.visuals.keys()]) this.unload(key);
  }

  /** Chunk visuals currently resident — GPU memory stays flat because this stays bounded by the view margin. */
  get loadedChunkCount(): number {
    return this.visuals.size;
  }

  dispose(): void {
    for (const key of [...this.visuals.keys()]) this.unload(key);
  }
}
