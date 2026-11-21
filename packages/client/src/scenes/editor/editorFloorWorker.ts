import { generateFiniteFloor, type FloorGenerationRequest, type GeneratedFloor } from "@dc2d/engine";

interface EditorFloorWorkerRequest {
  readonly id: number;
  readonly request: FloorGenerationRequest;
}

const worker = self as unknown as DedicatedWorkerPort;
worker.onmessage = (event: MessageEvent<EditorFloorWorkerRequest>) => {
  try {
    const floor = generateFiniteFloor(event.data.request);
    worker.postMessage({ id: event.data.id, floor }, transferBuffers(floor));
  } catch (error) {
    worker.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  }
};

function transferBuffers(floor: GeneratedFloor): Transferable[] {
  return [
    floor.tiles, floor.terrain, floor.features, floor.featureFaces, floor.featureHeight,
    floor.height, floor.zones, floor.semantic, floor.biome, floor.region, floor.territory,
    floor.protectedCells, floor.roomIds, floor.roomWallIds, floor.featureIds,
  ].map((plane) => plane.buffer);
}

interface DedicatedWorkerPort {
  onmessage: ((event: MessageEvent<EditorFloorWorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
