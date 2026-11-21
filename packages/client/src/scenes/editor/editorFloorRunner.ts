import type { FloorGenerationRequest, GeneratedFloor } from "@dc2d/engine";

export interface EditorFloorJob {
  readonly promise: Promise<GeneratedFloor>;
  cancel(): void;
}

export interface EditorFloorRunner {
  request(request: FloorGenerationRequest): EditorFloorJob;
  dispose(): void;
}

interface EditorFloorWorkerRequest {
  readonly id: number;
  readonly request: FloorGenerationRequest;
}

interface EditorFloorWorkerResult {
  readonly id: number;
  readonly floor?: GeneratedFloor;
  readonly error?: string;
}

export function createEditorFloorRunner(): EditorFloorRunner {
  return typeof Worker === "undefined"
    ? new UnavailableEditorFloorRunner()
    : new WorkerEditorFloorRunner();
}

class UnavailableEditorFloorRunner implements EditorFloorRunner {
  request(request: FloorGenerationRequest): EditorFloorJob {
    void request;
    return {
      promise: Promise.reject(new Error("Editor floor generation requires Web Worker support.")),
      cancel: () => {},
    };
  }

  dispose(): void {}
}

class WorkerEditorFloorRunner implements EditorFloorRunner {
  private worker: Worker;
  private nextId = 0;
  private disposed = false;
  private readonly pending = new Map<number, { resolve: (floor: GeneratedFloor) => void; reject: (reason: unknown) => void }>();

  constructor() { this.worker = this.createWorker(); }

  request(request: FloorGenerationRequest): EditorFloorJob {
    if (this.disposed) throw new Error("Editor floor runner disposed.");
    const id = this.nextId++;
    const promise = new Promise<GeneratedFloor>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, request } satisfies EditorFloorWorkerRequest);
    });
    return { promise, cancel: () => this.cancel(id) };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const pending of this.pending.values()) pending.reject(new Error("Editor floor generation disposed."));
    this.pending.clear();
    this.worker.terminate();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("./editorFloorWorker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<EditorFloorWorkerResult>) => this.resolve(event.data));
    return worker;
  }

  private cancel(id: number): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    pending.reject(new Error("Editor floor generation cancelled."));
    this.restartWorker(new Error("Editor floor generation cancelled."));
  }

  private restartWorker(reason: Error): void {
    const oldWorker = this.worker;
    oldWorker.terminate();
    for (const pending of this.pending.values()) pending.reject(reason);
    this.pending.clear();
    if (!this.disposed) this.worker = this.createWorker();
  }

  private resolve(message: EditorFloorWorkerResult): void {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.floor) pending.resolve(message.floor);
    else pending.reject(new Error(message.error ?? "Editor floor generation failed."));
  }
}
