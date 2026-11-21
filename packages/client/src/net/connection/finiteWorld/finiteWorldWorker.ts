import { generateFiniteFloor, type GeneratedFloor } from "@dc2d/engine";
import { decodeFiniteFloorArtifact } from "./finiteFloorArtifact.js";
import type { FiniteWorldRequest } from "./finiteWorldRunner.js";

interface FiniteWorldWorkerRequest {
  readonly id: number;
  readonly request: FiniteWorldRequest;
}

const worker = self as unknown as DedicatedWorkerPort;

worker.onmessage = async (event: MessageEvent<FiniteWorldWorkerRequest>) => {
  try {
    const floor = event.data.request.finiteFloorArtifact
      ? await decodeFiniteFloorArtifact(event.data.request.finiteFloorArtifact)
      : generateFiniteFloor(event.data.request);
    worker.postMessage({ id: event.data.id, floor }, transferBuffers(floor));
  } catch (error) {
    worker.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  }
};

function transferBuffers(floor: GeneratedFloor): Transferable[] {
  return [
    floor.tiles, floor.terrain, floor.features, floor.featureFaces,
    floor.featureHeight, floor.height, floor.zones, floor.semantic,
    floor.biome, floor.region, floor.territory, floor.protectedCells,
    floor.roomIds, floor.roomWallIds, floor.featureIds,
  ].map((plane) => plane.buffer);
}

interface DedicatedWorkerPort {
  onmessage: ((event: MessageEvent<FiniteWorldWorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
