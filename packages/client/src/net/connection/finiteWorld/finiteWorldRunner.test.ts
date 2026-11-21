import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedFloor } from "@dc2d/engine";
import { clearFiniteWorldCache, createFiniteWorldRunner } from "./finiteWorldRunner.js";

class FakeWorker {
  static instance: FakeWorker | undefined;
  private listener: ((event: MessageEvent) => void) | undefined;
  terminated = false;
  postCount = 0;
  constructor(url: URL, options: WorkerOptions) { void url; void options; FakeWorker.instance = this; }
  addEventListener(_type: string, listener: (event: MessageEvent) => void): void { this.listener = listener; }
  postMessage(message: unknown): void { void message; this.postCount += 1; }
  terminate(): void { this.terminated = true; }
  respond(message: unknown): void { if (!this.terminated) this.listener?.({ data: message } as MessageEvent); }
}

describe("finite world runner", () => {
  beforeEach(() => {
    clearFiniteWorldCache();
    FakeWorker.instance = undefined;
  });

  it("hands generated floors back through a Worker without main-thread generation", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createFiniteWorldRunner();
    const job = runner.request({ worldSeed: 7, floor: 1 });
    const floor = {} as GeneratedFloor;
    expect(FakeWorker.instance?.terminated).toBe(false);
    FakeWorker.instance?.respond({ id: 0, floor });
    await expect(job.promise).resolves.toBe(floor);
    runner.dispose();
    expect(FakeWorker.instance?.terminated).toBe(true);
    vi.unstubAllGlobals();
  });

  it("fails instead of synchronously generating when Worker support is absent", async () => {
    vi.stubGlobal("Worker", undefined);
    const runner = createFiniteWorldRunner();
    await expect(runner.request({ worldSeed: 7, floor: 1 }).promise).rejects.toThrow("requires Web Worker support");
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it("reuses a completed floor on a later runner without reposting generation work", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const firstRunner = createFiniteWorldRunner();
    const firstJob = firstRunner.request({ worldSeed: 8, floor: 1 });
    const floor = {} as GeneratedFloor;
    FakeWorker.instance?.respond({ id: 0, floor });
    await expect(firstJob.promise).resolves.toBe(floor);
    firstRunner.dispose();

    const secondRunner = createFiniteWorldRunner();
    const secondJob = secondRunner.request({ worldSeed: 8, floor: 1 });
    await expect(secondJob.promise).resolves.toBe(floor);
    expect(FakeWorker.instance?.postCount).toBe(0);
    secondRunner.dispose();
    vi.unstubAllGlobals();
  });

  it("does not reuse a prior cache entry for an artifact-bearing request", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createFiniteWorldRunner();
    const generated = {} as GeneratedFloor;
    const first = runner.request({ worldSeed: 9, floor: 1 });
    FakeWorker.instance?.respond({ id: 0, floor: generated });
    await expect(first.promise).resolves.toBe(generated);

    const artifact = "gzip-base64-v1:authoritative";
    const second = runner.request({ worldSeed: 9, floor: 1, finiteFloorArtifact: artifact });
    expect(FakeWorker.instance?.postCount).toBe(2);
    const authoritative = {} as GeneratedFloor;
    FakeWorker.instance?.respond({ id: 1, floor: authoritative });
    await expect(second.promise).resolves.toBe(authoritative);
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it("coalesces overlapping requests for the same floor into one worker job", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createFiniteWorldRunner();
    const first = runner.request({ worldSeed: 10, floor: 2 });
    const second = runner.request({ worldSeed: 10, floor: 2 });

    expect(FakeWorker.instance?.postCount).toBe(1);
    const floor = {} as GeneratedFloor;
    FakeWorker.instance?.respond({ id: 0, floor });
    await expect(first.promise).resolves.toBe(floor);
    await expect(second.promise).resolves.toBe(floor);
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it("keeps generated and artifact-backed overlap on separate worker jobs", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createFiniteWorldRunner();
    const generatedJob = runner.request({ worldSeed: 11, floor: 2 });
    const artifactJob = runner.request({
      worldSeed: 11,
      floor: 2,
      finiteFloorArtifact: "gzip-base64-v1:floor-11-2",
    });

    expect(FakeWorker.instance?.postCount).toBe(2);
    const generated = {} as GeneratedFloor;
    const artifact = {} as GeneratedFloor;
    FakeWorker.instance?.respond({ id: 0, floor: generated });
    FakeWorker.instance?.respond({ id: 1, floor: artifact });
    await expect(generatedJob.promise).resolves.toBe(generated);
    await expect(artifactJob.promise).resolves.toBe(artifact);
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it("cancels one coalesced caller without rejecting the other", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createFiniteWorldRunner();
    const first = runner.request({ worldSeed: 12, floor: 2 });
    const second = runner.request({ worldSeed: 12, floor: 2 });

    first.cancel();
    const floor = {} as GeneratedFloor;
    FakeWorker.instance?.respond({ id: 0, floor });
    await expect(first.promise).rejects.toThrow("cancelled");
    await expect(second.promise).resolves.toBe(floor);
    expect(FakeWorker.instance?.postCount).toBe(1);
    runner.dispose();
    vi.unstubAllGlobals();
  });
});
