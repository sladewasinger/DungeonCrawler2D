import { parentPort } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import {
  createFiniteFloorArtifact,
  finiteFloorForRuntime,
  type FloorGenerationConfig,
  type GeneratedFloor,
} from "@dc2d/engine";

const ARTIFACT_PREFIX = "gzip-base64-v1:";

interface PrepareFloorMessage {
  readonly id: number;
  readonly worldSeed: number;
  readonly floor: number;
  readonly voidTerrain: boolean;
  readonly config?: FloorGenerationConfig;
}

interface PreparedFloorMessage {
  readonly id: number;
  readonly floor: GeneratedFloor;
  readonly artifact: string;
}

if (!parentPort) throw new Error("Floor preparation worker requires a parent port");

parentPort.on("message", (message: PrepareFloorMessage) => {
  try {
    const floor = finiteFloorForRuntime({
      worldSeed: message.worldSeed,
      floor: message.floor,
      features: { voidTerrain: message.voidTerrain },
      ...(message.config ? { config: message.config } : {}),
    });
    const response: PreparedFloorMessage = {
      id: message.id,
      floor,
      artifact: encodeArtifact(floor),
    };
    parentPort!.postMessage(response, transferBuffers(floor));
  } catch (error) {
    parentPort!.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

function encodeArtifact(floor: GeneratedFloor): string {
  const artifact = createFiniteFloorArtifact(floor, (plane) =>
    Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength).toString("base64"));
  const json = JSON.stringify(artifact);
  return `${ARTIFACT_PREFIX}${gzipSync(json).toString("base64")}`;
}

function transferBuffers(floor: GeneratedFloor): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  for (const value of Object.values(floor)) {
    if (!ArrayBuffer.isView(value)) continue;
    const buffer = value.buffer;
    if (buffer instanceof ArrayBuffer) buffers.add(buffer);
  }
  return [...buffers];
}
