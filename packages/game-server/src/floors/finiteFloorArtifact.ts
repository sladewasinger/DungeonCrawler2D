import { gzipSync } from "node:zlib";
import {
  createFiniteFloorArtifact,
  type GeneratedFloor,
} from "@dc2d/engine";

const ARTIFACT_PREFIX = "gzip-base64-v1:";

export function encodeFiniteFloorArtifact(floor: GeneratedFloor): string {
  const artifact = createFiniteFloorArtifact(floor, encodePlane);
  const json = JSON.stringify(artifact);
  return `${ARTIFACT_PREFIX}${gzipSync(json).toString("base64")}`;
}

function encodePlane(plane: ArrayBufferView): string {
  return Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength).toString("base64");
}
