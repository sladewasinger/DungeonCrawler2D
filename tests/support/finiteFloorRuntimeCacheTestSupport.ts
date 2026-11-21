import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import type { FiniteFloorArtifact } from "../../packages/engine/src/world/generate/artifact/finiteFloorArtifact.js";
import type { FiniteFloorRuntimeCacheRequest } from "../../packages/engine/src/world/generate/finiteFloor.js";
import { runtimeArtifactContentFingerprintForTest } from "./finiteFloorRuntimeCacheSetup.js";

export type RuntimeArtifactFault = "identity" | "bounds" | "content" | "partial";

interface RuntimeEnvelope {
  artifact: FiniteFloorArtifact;
  contentFingerprint: string;
}

export function corruptRuntimeArtifact(
  path: string,
  fault: RuntimeArtifactFault,
  request: FiniteFloorRuntimeCacheRequest,
): void {
  if (fault === "partial") {
    writeFileSync(path, readFileSync(path).subarray(0, 8));
    return;
  }
  const envelope = readRuntimeEnvelope(path);
  const metadata = JSON.parse(envelope.artifact.metadata) as Record<string, unknown>;
  if (fault === "identity") metadata.worldSeed = request.worldSeed + 1;
  if (fault === "bounds") mutateRuntimeBounds(metadata);
  if (fault === "content") envelope.artifact = mutateRuntimePlane(envelope.artifact);
  else envelope.artifact = { ...envelope.artifact, metadata: JSON.stringify(metadata) };
  if (fault !== "content") {
    envelope.contentFingerprint = runtimeArtifactContentFingerprintForTest(envelope.artifact);
  }
  writeFileSync(path, gzipSync(JSON.stringify(envelope)));
}

function readRuntimeEnvelope(path: string): RuntimeEnvelope {
  return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as RuntimeEnvelope;
}

function mutateRuntimeBounds(metadata: Record<string, unknown>): void {
  const bounds = metadata.bounds as Record<string, number>;
  const identity = metadata.identity as { bounds: Record<string, number> };
  bounds.maxX += 1;
  identity.bounds.maxX += 1;
}

function mutateRuntimePlane(artifact: FiniteFloorArtifact): FiniteFloorArtifact {
  const tiles = artifact.planes.tiles;
  const replacement = tiles.endsWith("A") ? "B" : "A";
  return { ...artifact, planes: { ...artifact.planes, tiles: `${tiles.slice(0, -1)}${replacement}` } };
}
