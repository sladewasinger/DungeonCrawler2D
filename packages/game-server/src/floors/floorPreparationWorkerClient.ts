import { Worker } from "node:worker_threads";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FloorGenerationConfig, GeneratedFloor } from "@dc2d/engine";

export interface FloorPreparationRequest {
  readonly worldSeed: number;
  readonly floor: number;
  readonly voidTerrain: boolean;
  readonly config?: FloorGenerationConfig;
}

export interface PreparedFloor {
  readonly floor: GeneratedFloor;
  readonly artifact: string;
}

interface WorkerSuccess {
  readonly id: number;
  readonly floor: GeneratedFloor;
  readonly artifact: string;
}

interface WorkerFailure {
  readonly id: number;
  readonly error: string;
}

interface PendingRequest {
  readonly resolve: (result: PreparedFloor) => void;
  readonly reject: (error: Error) => void;
}

/** One background worker owns unseen-floor generation and artifact encoding. */
export class FloorPreparationWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;

  constructor() {
    const path = workerPath();
    this.worker = new Worker(path, {
      execArgv: workerExecArgv(path),
    });
    this.worker.unref();
    this.worker.on("message", (message: WorkerSuccess | WorkerFailure) =>
      this.resolve(message));
    this.worker.on("error", (error) => this.rejectAll(error));
    this.worker.on("exit", (code) => {
      if (this.pending.size > 0) {
        this.rejectAll(new Error(`Floor preparation worker exited with code ${code}`));
      }
    });
  }

  prepare(request: FloorPreparationRequest): Promise<PreparedFloor> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.ref();
      try {
        this.worker.postMessage({ id, ...request });
      } catch (error) {
        this.pending.delete(id);
        this.unrefWhenIdle();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async dispose(): Promise<void> {
    this.rejectAll(new Error("Floor preparation worker disposed"));
    await this.worker.terminate();
  }

  private resolve(message: WorkerSuccess | WorkerFailure): void {
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    if ("error" in message) request.reject(new Error(message.error));
    else request.resolve({ floor: message.floor, artifact: message.artifact });
    this.unrefWhenIdle();
  }

  private rejectAll(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
    this.unrefWhenIdle();
  }

  private unrefWhenIdle(): void {
    if (this.pending.size === 0) this.worker.unref();
  }
}

function workerPath(): string {
  const entry = process.argv.find((argument) =>
    argument.endsWith("/main.ts") || argument.endsWith("/main.cjs"));
  const candidates = entry?.endsWith("main.cjs")
    ? [join(dirname(entry), "floorPreparationWorker.cjs")]
    : [
      join(process.cwd(), "src/floors/floorPreparationWorker.ts"),
      join(process.cwd(), "packages/game-server/src/floors/floorPreparationWorker.ts"),
    ];
  const fallback = [
    join(process.cwd(), "dist/floorPreparationWorker.cjs"),
    join(process.cwd(), "packages/game-server/dist/floorPreparationWorker.cjs"),
  ];
  const path = [...candidates, ...fallback].find(existsSync);
  if (!path) throw new Error("Floor preparation worker entry was not found");
  return path;
}

function workerExecArgv(path: string): string[] {
  const args = process.execArgv.filter((argument) => !argument.startsWith("--input-type"));
  if (path.endsWith(".ts") && !args.includes("tsx")) return [...args, "--import", "tsx"];
  return args;
}
