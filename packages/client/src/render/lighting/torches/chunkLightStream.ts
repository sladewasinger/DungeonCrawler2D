import type { World } from "@dc2d/engine";
import {
  chunkKey,
  chunkWindowKey,
  desiredChunks,
  diffChunks,
  type ViewRect,
} from "../../terrain/streaming/streaming.js";
import type { LightSource } from "../core/lightSource.js";
import {
  createLightStreamState,
  invalidateLightStream,
  refreshLightStreamRevision,
} from "../core/lightStreamState.js";
import { LIGHT_LOAD_MARGIN_CHUNKS } from "../lightingRuntimeStyle.js";
import { ChunkLightScanner } from "./chunkLightScanner.js";

/** Caches authored lights by the same view-oriented chunk window as terrain. */
export class ChunkLightStream {
  private readonly lights = new Map<string, LightSource[]>();
  private readonly state = createLightStreamState();
  private readonly scanner: ChunkLightScanner;

  constructor(
    private readonly world: World,
    private readonly loadMarginChunks = LIGHT_LOAD_MARGIN_CHUNKS,
  ) {
    this.scanner = new ChunkLightScanner(world);
  }

  stream(view: ViewRect): void {
    refreshLightStreamRevision(this.state, this.lights, this.world.tileRevision);
    const window = chunkWindowKey(view, this.loadMarginChunks);
    if (window === this.state.window) return;
    const desired = desiredChunks(view, this.loadMarginChunks);
    const changes = diffChunks(desired, new Set(this.lights.keys()));
    for (const coord of changes.toLoad) {
      this.lights.set(chunkKey(coord), this.scanner.scan(coord));
    }
    for (const key of changes.toUnloadKeys) this.lights.delete(key);
    this.state.window = window;
  }

  values(): Iterable<readonly LightSource[]> {
    return this.lights.values();
  }

  invalidate(): void {
    invalidateLightStream(this.state, this.lights);
  }
}
