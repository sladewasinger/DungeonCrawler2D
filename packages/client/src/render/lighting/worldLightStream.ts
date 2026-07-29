import { CHUNK_SIZE, type World } from "@dc2d/engine";
import { viewChunkWorldOrigin } from "./core/viewChunkOrigin.js";
import {
  createLightStreamState,
  invalidateLightStream,
  refreshLightStreamRevision,
} from "./core/lightStreamState.js";
import { hashSeed, type LightSource } from "./core/lightSource.js";
import {
  chunkKey,
  chunkWindowKey,
  desiredChunks,
  diffChunks,
  type ChunkCoord,
  type ViewRect,
} from "../terrain/streaming/streaming.js";
import { getViewOrientation } from "../view/transform/viewState.js";
import {
  doorLightPositions,
  type DoorLightMount,
} from "./torches/doorLights.js";
import { TORCH_COLOR, TORCH_RADIUS_TILES } from "./torches/torchLightStyle.js";
import {
  selectTorchPositions,
  torchCandidates,
  type TilePos,
  type TileRect,
} from "./torches/torchPlacement.js";
import {
  LIGHT_LOAD_MARGIN_CHUNKS,
  PORTAL_LIGHT_COLOR,
  PORTAL_LIGHT_RADIUS_TILES,
} from "./lightingRuntimeStyle.js";

/** Streams authored wall/door lights in the same view-chunk window as terrain. */
export class WorldLightStream {
  private readonly lightsByChunk = new Map<string, LightSource[]>();
  private readonly stream = createLightStreamState();

  constructor(private readonly world: World) {}

  update(view: ViewRect): void {
    refreshLightStreamRevision(this.stream, this.lightsByChunk, this.world.tileRevision);
    const window = chunkWindowKey(view, LIGHT_LOAD_MARGIN_CHUNKS);
    if (window === this.stream.window) return;
    const desired = desiredChunks(view, LIGHT_LOAD_MARGIN_CHUNKS);
    const changed = diffChunks(desired, new Set(this.lightsByChunk.keys()));
    for (const coord of changed.toLoad) {
      this.lightsByChunk.set(chunkKey(coord), this.scanChunk(coord));
    }
    for (const key of changed.toUnloadKeys) this.lightsByChunk.delete(key);
    this.stream.window = window;
  }

  values(): Iterable<readonly LightSource[]> {
    return this.lightsByChunk.values();
  }

  invalidate(): void {
    invalidateLightStream(this.stream, this.lightsByChunk);
  }

  private scanChunk(coord: ChunkCoord): LightSource[] {
    const bounds = this.chunkBounds(coord);
    const torches = selectTorchPositions(torchCandidates(this.world, bounds))
      .map((position) => this.torchLight(position));
    const doors = doorLightPositions(this.world, bounds)
      .map((position) => this.doorLight(position));
    return [...torches, ...doors];
  }

  private chunkBounds(coord: ChunkCoord): TileRect {
    const origin = viewChunkWorldOrigin({
      baseVX: coord.cx * CHUNK_SIZE,
      baseVY: coord.cy * CHUNK_SIZE,
      size: CHUNK_SIZE,
      orientation: getViewOrientation(),
    });
    return {
      x0: origin.x,
      y0: origin.y,
      x1: origin.x + CHUNK_SIZE,
      y1: origin.y + CHUNK_SIZE,
    };
  }

  private torchLight(position: TilePos): LightSource {
    const id = `torch:${position.wx},${position.wy}`;
    return {
      id,
      x: position.wx + 0.5,
      y: position.wy + 1.1,
      color: TORCH_COLOR,
      radiusTiles: TORCH_RADIUS_TILES,
      kind: "torch",
      seed: hashSeed(id),
      groundHeight: this.world.groundAt(position.wx + 0.5, position.wy + 0.5),
    };
  }

  private doorLight(position: DoorLightMount): LightSource {
    const id = `door:${position.wx},${position.wy}`;
    return {
      id,
      x: position.x,
      y: position.y,
      color: PORTAL_LIGHT_COLOR,
      radiusTiles: PORTAL_LIGHT_RADIUS_TILES,
      kind: "portal",
      seed: hashSeed(id),
      groundHeight: position.projectionHeight,
    };
  }
}
