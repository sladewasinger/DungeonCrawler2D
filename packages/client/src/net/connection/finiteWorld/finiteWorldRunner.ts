import type { FloorGenerationRequest, GeneratedFloor } from "@dc2d/engine";
import { recordRuntimeWork } from "../../../performance/runtimeWorkMetrics.js";

export interface FiniteWorldRequest extends FloorGenerationRequest {
  readonly finiteFloorArtifact?: string;
}

const COMPLETED_FLOOR_CACHE = new Map<string, GeneratedFloor>();

export function clearFiniteWorldCache(): void {
  COMPLETED_FLOOR_CACHE.clear();
}

export interface FiniteWorldJob {
  readonly promise: Promise<GeneratedFloor>;
  cancel(): void;
}

export interface FiniteWorldRunner {
  request(request: FiniteWorldRequest): FiniteWorldJob;
  dispose(): void;
}

interface FiniteWorldWorkerRequest {
  readonly id: number;
  readonly request: FiniteWorldRequest;
}

interface FiniteWorldWorkerResult {
  readonly id: number;
  readonly floor?: GeneratedFloor;
  readonly error?: string;
}

export function createFiniteWorldRunner(): FiniteWorldRunner {
  return typeof Worker === "undefined" ? new UnavailableFiniteWorldRunner() : new WorkerFiniteWorldRunner();
}

class UnavailableFiniteWorldRunner implements FiniteWorldRunner {
  request(request: FiniteWorldRequest): FiniteWorldJob {
    void request;
    return { promise: Promise.reject(new Error("Finite dungeon loading requires Web Worker support.")), cancel: () => {} };
  }
  dispose(): void {}
}

class WorkerFiniteWorldRunner implements FiniteWorldRunner {
  private worker: Worker;
  private nextId = 0;
  private disposed = false;
  private nextSubscriptionId = 0;
  private readonly pending = new Map<number, SharedFiniteWorld>();
  private readonly inFlight = new Map<string, SharedFiniteWorld>();

  constructor() { this.worker = this.createWorker(); }

  request(request: FiniteWorldRequest): FiniteWorldJob {
    if (this.disposed) throw new Error("Finite world runner disposed.");
    const artifact = Boolean(request.finiteFloorArtifact);
    const key = floorCacheKey(request);
    const cached = artifact ? undefined : COMPLETED_FLOOR_CACHE.get(key);
    if (cached) {
      recordRuntimeWork("finiteWorld.cacheHit", 0);
      return { promise: Promise.resolve(cached), cancel: () => {} };
    }
    const existing = this.inFlight.get(key);
    if (existing) return this.subscribe(existing);
    const workerId = this.nextId++;
    const started = performance.now();
    const shared: SharedFiniteWorld = {
      key,
      started,
      artifact: Boolean(request.finiteFloorArtifact),
      subscribers: new Map(),
    };
    this.pending.set(workerId, shared);
    this.inFlight.set(key, shared);
    this.worker.postMessage({ id: workerId, request } satisfies FiniteWorldWorkerRequest);
    return this.subscribe(shared);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rejectPending(new Error("Finite world runner disposed."));
    this.worker.terminate();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("./finiteWorldWorker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<FiniteWorldWorkerResult>) => this.resolve(event.data));
    return worker;
  }

  private cancel(id: number): void {
    for (const shared of this.pending.values()) {
      const subscription = shared.subscribers.get(id);
      if (!subscription) continue;
      shared.subscribers.delete(id);
      subscription.reject(new Error("Finite world loading cancelled."));
      return;
    }
  }

  private rejectPending(reason: Error): void {
    for (const shared of this.pending.values()) {
      this.inFlight.delete(shared.key);
      for (const subscription of shared.subscribers.values()) subscription.reject(reason);
      shared.subscribers.clear();
    }
    this.pending.clear();
  }

  private resolve(message: FiniteWorldWorkerResult): void {
    const shared = this.pending.get(message.id);
    if (!shared) return;
    this.pending.delete(message.id);
    this.inFlight.delete(shared.key);
    if (message.floor) return this.resolveFloor(shared, message.floor);
    this.rejectSubscribers(shared, new Error(message.error ?? "Finite world loading failed."));
  }

  private resolveFloor(shared: SharedFiniteWorld, floor: GeneratedFloor): void {
    if (!shared.artifact) COMPLETED_FLOOR_CACHE.set(shared.key, floor);
    const metric = shared.artifact ? "finiteWorld.artifact" : "finiteWorld.worker";
    recordRuntimeWork(metric, performance.now() - shared.started);
    for (const subscription of shared.subscribers.values()) subscription.resolve(floor);
    shared.subscribers.clear();
  }

  private rejectSubscribers(shared: SharedFiniteWorld, reason: Error): void {
    for (const subscription of shared.subscribers.values()) subscription.reject(reason);
    shared.subscribers.clear();
  }

  private subscribe(shared: SharedFiniteWorld): FiniteWorldJob {
    const id = this.nextSubscriptionId++;
    const promise = new Promise<GeneratedFloor>((resolve, reject) => {
      shared.subscribers.set(id, { resolve, reject });
    });
    return { promise, cancel: () => this.cancel(id) };
  }
}

interface SharedFiniteWorld {
  readonly key: string;
  readonly started: number;
  readonly artifact: boolean;
  readonly subscribers: Map<number, FiniteWorldSubscriber>;
}

interface FiniteWorldSubscriber {
  readonly resolve: (floor: GeneratedFloor) => void;
  readonly reject: (reason: unknown) => void;
}

function floorCacheKey(request: FiniteWorldRequest): string {
  return JSON.stringify({
    seed: request.worldSeed,
    floor: request.floor,
    voidTerrain: request.features?.voidTerrain ?? true,
    config: request.config ?? null,
    finiteFloorArtifact: request.finiteFloorArtifact ?? null,
  });
}
