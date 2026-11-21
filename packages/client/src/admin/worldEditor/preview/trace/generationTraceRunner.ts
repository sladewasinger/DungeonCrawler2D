import type { FloorGenerationRequest, FloorGenerationTrace } from "@dc2d/engine";

export interface GenerationPreviewResult {
  readonly trace: FloorGenerationTrace;
}

export interface GenerationTraceJob {
  readonly promise: Promise<GenerationPreviewResult>;
  cancel(): void;
}

export const GENERATION_PREVIEW_DEADLINE_MS = 15_000;

export class GenerationPreviewBudgetError extends Error {
  readonly code = "generation-budget-exhausted" as const;

  constructor() {
    super(`generation-budget-exhausted: preview exceeded ${GENERATION_PREVIEW_DEADLINE_MS}ms; reduce room target or structure density`);
    this.name = "GenerationPreviewBudgetError";
  }
}

export interface GenerationTraceRunner {
  request(request: FloorGenerationRequest): GenerationTraceJob;
  dispose(): void;
}

interface TraceWorkerMessage {
  readonly id: number;
  readonly request: FloorGenerationRequest;
}

interface TraceWorkerResult {
  readonly id: number;
  readonly result?: GenerationPreviewResult;
  readonly error?: string;
}

/**
 * The worker is a serialization boundary for the editor only. The next editor
 * layer can replace this runner without changing controls, replay, or canvas
 * ownership; no server World or admin command crosses this boundary.
 */
export function createGenerationTraceRunner(): GenerationTraceRunner {
  if (typeof Worker === "undefined") return new UnavailableGenerationTraceRunner();
  return new WorkerGenerationTraceRunner();
}

class UnavailableGenerationTraceRunner implements GenerationTraceRunner {
  request(request: FloorGenerationRequest): GenerationTraceJob {
    void request;
    return {
      promise: Promise.reject(new Error("Generation preview requires Web Worker support.")),
      cancel: () => {},
    };
  }

  dispose(): void {}
}

class WorkerGenerationTraceRunner implements GenerationTraceRunner {
  private worker: Worker;
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (value: GenerationPreviewResult) => void; reject: (reason: unknown) => void }>();
  private readonly deadlines = new Map<number, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor() {
    this.worker = this.createWorker();
  }

  request(request: FloorGenerationRequest): GenerationTraceJob {
    if (this.disposed) throw new Error("Generation preview runner disposed.");
    const id = this.nextId++;
    const promise = new Promise<GenerationPreviewResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, request } satisfies TraceWorkerMessage);
      this.deadlines.set(id, setTimeout(() => this.expire(id), GENERATION_PREVIEW_DEADLINE_MS));
    });
    return {
      promise,
      cancel: () => this.cancel(id),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of this.pending.keys()) this.clearDeadline(id);
    for (const pending of this.pending.values()) pending.reject(new Error("Generation preview disposed."));
    this.pending.clear();
    this.worker.terminate();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("./generationTraceWorker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<TraceWorkerResult>) => this.resolve(event.data));
    return worker;
  }

  private cancel(id: number): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.clearDeadline(id);
    this.pending.delete(id);
    pending.reject(new Error("Generation preview request cancelled."));
    this.restartWorker(new Error("Generation preview request cancelled."));
  }

  private restartWorker(reason: Error): void {
    const oldWorker = this.worker;
    oldWorker.terminate();
    for (const id of this.pending.keys()) this.clearDeadline(id);
    for (const pending of this.pending.values()) pending.reject(reason);
    this.pending.clear();
    if (!this.disposed) this.worker = this.createWorker();
  }

  private resolve(message: TraceWorkerResult): void {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.clearDeadline(message.id);
    this.pending.delete(message.id);
    if (message.result) pending.resolve(message.result);
    else pending.reject(new Error(message.error ?? "Generation preview failed."));
  }

  private expire(id: number): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.clearDeadline(id);
    this.pending.delete(id);
    pending.reject(new GenerationPreviewBudgetError());
    this.restartWorker(new GenerationPreviewBudgetError());
  }

  private clearDeadline(id: number): void {
    const deadline = this.deadlines.get(id);
    if (!deadline) return;
    clearTimeout(deadline);
    this.deadlines.delete(id);
  }
}
