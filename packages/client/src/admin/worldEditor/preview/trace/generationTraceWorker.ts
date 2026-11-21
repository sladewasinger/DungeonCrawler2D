import { generateFiniteFloorTrace, type FloorGenerationRequest, type FloorGenerationTrace } from "@dc2d/engine";

interface TraceWorkerMessage {
  readonly id: number;
  readonly request: FloorGenerationRequest;
}

const worker = self as unknown as DedicatedWorkerPort;
worker.onmessage = (event: MessageEvent<TraceWorkerMessage>) => {
  try {
    const result = generateFiniteFloorTrace(event.data.request);
    const trace = result.trace;
    worker.postMessage({ id: event.data.id, result: { trace } }, traceBuffers(trace));
  } catch (error) {
    worker.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  }
};

interface DedicatedWorkerPort {
  onmessage: ((event: MessageEvent<TraceWorkerMessage>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

function traceBuffers(trace: FloorGenerationTrace): Transferable[] {
  return trace.snapshots.flatMap((snapshot) => [
    snapshot.height.buffer,
    snapshot.semantic.buffer,
    snapshot.roomWallIds.buffer,
    snapshot.territory.buffer,
    snapshot.region.buffer,
    snapshot.featureIds.buffer,
  ]);
}
