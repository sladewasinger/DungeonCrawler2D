import type { World } from "@dc2d/engine";
import {
  chunkKey,
  chunkWindowKey,
  desiredChunks,
  diffChunks,
  type ChunkCoord,
  type ViewRect,
} from "../../terrain/streaming/streaming.js";
import type { LightSource } from "../core/lightSource.js";
import { measureRuntimeWork } from "../../../performance/runtimeWorkMetrics.js";
import {
  createLightStreamState,
  invalidateLightStream,
  refreshLightStreamRevision,
} from "../core/lightStreamState.js";
import { LIGHT_LOAD_MARGIN_CHUNKS, LIGHT_SCAN_BUDGET } from "../lightingRuntimeStyle.js";
import { ChunkLightScanner } from "./chunkLightScanner.js";

export interface ChunkLightScannerLike {
  scan(coord: ChunkCoord): LightSource[];
}

export interface ChunkLightStreamOptions {
  readonly loadMarginChunks?: number;
  readonly scanBudget?: number;
  readonly scanner?: ChunkLightScannerLike;
}

/** Caches authored lights by the same view-oriented chunk window as terrain. */
export class ChunkLightStream {
  private readonly lights = new Map<string, LightSource[]>();
  private readonly state = createLightStreamState();
  private readonly pending = new Map<string, ChunkCoord>();
  private readonly scanner: ChunkLightScannerLike;
  private readonly scanBudget: number;

  constructor(
    private readonly world: World,
    options: ChunkLightStreamOptions = {},
  ) {
    this.loadMarginChunks = options.loadMarginChunks ?? LIGHT_LOAD_MARGIN_CHUNKS;
    this.scanBudget = Math.max(1, options.scanBudget ?? LIGHT_SCAN_BUDGET);
    this.scanner = options.scanner ?? new ChunkLightScanner(world);
  }

  private readonly loadMarginChunks: number;

  stream(view: ViewRect): void {
    if (this.state.revision !== this.world.tileRevision) this.pending.clear();
    refreshLightStreamRevision(this.state, this.lights, this.world.tileRevision);
    const window = chunkWindowKey(view, this.loadMarginChunks);
    if (window !== this.state.window) {
      this.enqueueWindow(view, window);
    }
    this.scanPending();
  }

  values(): Iterable<readonly LightSource[]> {
    return this.lights.values();
  }

  invalidate(): void {
    invalidateLightStream(this.state, this.lights);
    this.pending.clear();
  }

  pendingScanCount(): number {
    return this.pending.size;
  }

  private enqueueWindow(view: ViewRect, window: string): void {
    const desired = desiredChunks(view, this.loadMarginChunks);
    const desiredKeys = new Set(desired.map(chunkKey));
    for (const key of this.pending.keys()) {
      if (!desiredKeys.has(key)) this.pending.delete(key);
    }
    const loaded = new Set([...this.lights.keys(), ...this.pending.keys()]);
    const changes = diffChunks(desired, loaded);
    for (const coord of changes.toLoad) this.pending.set(chunkKey(coord), coord);
    for (const key of changes.toUnloadKeys) this.lights.delete(key);
    this.state.window = window;
  }

  private scanPending(): void {
    let scanned = 0;
    for (const [key, coord] of this.pending) {
      if (scanned >= this.scanBudget) return;
      this.pending.delete(key);
      this.lights.set(key, measureRuntimeWork(
        "lighting.authoredLightScan",
        () => this.scanner.scan(coord),
      ));
      scanned += 1;
    }
  }
}
