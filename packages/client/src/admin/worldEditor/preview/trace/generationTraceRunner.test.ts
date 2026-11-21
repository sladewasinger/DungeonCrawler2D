import { describe, expect, it, vi } from "vitest";
import type { FloorGenerationTrace } from "@dc2d/engine";
import {
  createGenerationTraceRunner,
  GenerationPreviewBudgetError,
  GENERATION_PREVIEW_DEADLINE_MS,
  type GenerationPreviewResult,
} from "./generationTraceRunner.js";

class FakeWorker {
  static instance: FakeWorker | undefined;
  readonly messages: unknown[] = [];
  private listener: ((event: MessageEvent) => void) | undefined;
  terminated = false;

  constructor(url: URL, options: WorkerOptions) {
    void url;
    void options;
    FakeWorker.instance = this;
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void): void { this.listener = listener; }
  postMessage(message: unknown): void { this.messages.push(message); }
  terminate(): void { this.terminated = true; }
  respond(message: unknown): void {
    if (!this.terminated) this.listener?.({ data: message } as MessageEvent);
  }
}

describe("generation trace runner", () => {
  it("uses the editor Worker boundary when Worker is available", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createGenerationTraceRunner();
    const job = runner.request({ worldSeed: 7, floor: 1 });
    const worker = FakeWorker.instance;
    expect(worker?.messages).toHaveLength(1);
    const result = { trace: {} as FloorGenerationTrace } as GenerationPreviewResult;
    worker?.respond({ id: 0, result });
    await expect(job.promise).resolves.toBe(result);
    runner.dispose();
    expect(worker?.terminated).toBe(true);
    vi.unstubAllGlobals();
  });

  it("terminates the active Worker when a request is cancelled", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createGenerationTraceRunner();
    const first = runner.request({ worldSeed: 7, floor: 1 });
    const firstWorker = FakeWorker.instance;
    first.cancel();
    await expect(first.promise).rejects.toThrow("cancelled");
    expect(firstWorker?.terminated).toBe(true);
    const second = runner.request({ worldSeed: 8, floor: 1 });
    expect(FakeWorker.instance).not.toBe(firstWorker);
    const result = { trace: {} as FloorGenerationTrace } as GenerationPreviewResult;
    FakeWorker.instance?.respond({ id: 1, result });
    await expect(second.promise).resolves.toBe(result);
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it("fails without Worker support instead of generating on the main thread", async () => {
    vi.stubGlobal("Worker", undefined);
    const runner = createGenerationTraceRunner();
    const job = runner.request({ worldSeed: 7, floor: 1 });
    await expect(job.promise).rejects.toThrow("requires Web Worker support");
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it("terminates a worker and rejects with a typed budget error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createGenerationTraceRunner();
    const job = runner.request({ worldSeed: 7, floor: 1 });
    const worker = FakeWorker.instance;
    vi.advanceTimersByTime(GENERATION_PREVIEW_DEADLINE_MS);
    await expect(job.promise).rejects.toBeInstanceOf(GenerationPreviewBudgetError);
    expect(worker?.terminated).toBe(true);
    runner.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
