import { describe, expect, it, vi } from "vitest";
import type { GeneratedFloor } from "@dc2d/engine";
import { createEditorFloorRunner } from "./editorFloorRunner.js";

class FakeWorker {
  static instance: FakeWorker | undefined;
  private listener: ((event: MessageEvent) => void) | undefined;
  terminated = false;

  constructor(url: URL, options: WorkerOptions) {
    void url;
    void options;
    FakeWorker.instance = this;
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void): void { this.listener = listener; }
  postMessage(message: unknown): void { void message; }
  terminate(): void { this.terminated = true; }
  respond(message: unknown): void {
    if (!this.terminated) this.listener?.({ data: message } as MessageEvent);
  }
}

describe("editor floor runner", () => {
  it("keeps finite floor generation off the main thread", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const runner = createEditorFloorRunner();
    const job = runner.request({ worldSeed: 7, floor: 1 });
    const floor = {} as GeneratedFloor;
    FakeWorker.instance?.respond({ id: 0, floor });
    await expect(job.promise).resolves.toBe(floor);
    runner.dispose();
    expect(FakeWorker.instance?.terminated).toBe(true);
    vi.unstubAllGlobals();
  });
});
