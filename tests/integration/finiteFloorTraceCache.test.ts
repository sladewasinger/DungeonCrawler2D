import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  generateFiniteFloorTraceForTests,
  installFiniteFloorTraceCache,
  type FiniteFloorTraceCacheRequest,
  type GeneratedFloorTrace,
} from "../../packages/engine/src/world/generate/finiteFloor.js";
import { normalizeFloorGenerationConfig } from "../../packages/engine/src/world/generate/config/floorGenerationConfig.js";
import {
  createFiniteFloorTraceCache,
  finiteFloorTraceCachePath,
} from "../support/finiteFloorTraceCacheSetup.js";
import { traceContentFingerprint } from "../support/finiteFloorTraceValidation.js";
import { FiniteFloorRuntimeLease, type FiniteFloorRuntimeLeaseState } from "../support/finiteFloorRuntimeLease.js";

const REQUEST = {
  worldSeed: 74621,
  floor: 1,
  voidTerrain: true,
  config: normalizeFloorGenerationConfig({ roomTargetCount: 8, targetLoopCount: 4, connectorSpacing: 2 }),
} satisfies FiniteFloorTraceCacheRequest;
const SOURCE = generateFiniteFloorTraceForTests(REQUEST);
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("finite floor trace artifact cache", () => {
  it("separates cold miss, warm immutable memory view, and warm disk clone", () => {
    const root = temporaryRoot("contract", true);
    const cache = createFiniteFloorTraceCache(root);
    const coldStart = performance.now();
    expect(cache.read(REQUEST)).toBeNull();
    expect(performance.now() - coldStart).toBeLessThan(1_000);
    cache.write(REQUEST, SOURCE);

    const memoryHit = required(cache.read(REQUEST), "trace memory hit");
    memoryHit.floor.tiles[0] = memoryHit.floor.tiles[0]! ^ 1;
    const exposedSnapshot = required(memoryHit.trace.snapshots[0], "exposed trace snapshot");
    const mutableSemantic = exposedSnapshot.semantic as Uint8Array;
    mutableSemantic[0] = mutableSemantic[0]! ^ 1;
    const isolated = required(cache.read(REQUEST), "isolated trace hit");
    const isolatedSnapshot = required(isolated.trace.snapshots[0], "isolated trace snapshot");
    const sourceSnapshot = required(SOURCE.trace.snapshots[0], "source trace snapshot");
    expect(isolated.floor.tiles[0]).toBe(SOURCE.floor.tiles[0]);
    expect(isolatedSnapshot.semantic[0]).toBe(sourceSnapshot.semantic[0]);

    const diskHit = required(createFiniteFloorTraceCache(root).read(REQUEST), "trace disk hit");
    expect(diskHit.floor.identity.fingerprint).toBe(SOURCE.floor.identity.fingerprint);
    expect(diskHit.floor.tiles).not.toBe(SOURCE.floor.tiles);
    expect(Object.isFrozen(diskHit.trace.snapshots)).toBe(true);
  });

  it.each(["identity", "bounds", "content", "floor-metadata", "partial"] as const)(
    "rejects an invalid %s artifact",
    (fault) => {
      const root = temporaryRoot(`invalid-${fault}`);
      const cache = createFiniteFloorTraceCache(root);
      cache.write(REQUEST, SOURCE);
      corruptTraceArtifact(finiteFloorTraceCachePath(REQUEST, root), fault);
      expect(createFiniteFloorTraceCache(root).read(REQUEST)).toBeNull();
    },
  );

  it("retains explicitly uncached trace determinism", () => {
    const restore = installFiniteFloorTraceCache(null);
    try {
      const uncached = generateFiniteFloorTraceForTests(REQUEST);
      expect(uncached.floor.identity).toEqual(SOURCE.floor.identity);
      expect(traceContentFingerprint(uncached.trace)).toBe(traceContentFingerprint(SOURCE.trace));
    } finally {
      restore();
    }
  });

  it("admits one owner when two lease claims overlap publication", () => {
    const path = join(temporaryRoot("lease-publication"), "artifact");
    const competitor = new FiniteFloorRuntimeLease();
    let competingState: FiniteFloorRuntimeLeaseState | undefined;
    const claimant = new FiniteFloorRuntimeLease({
      completionWaitMs: 0,
      beforePublish: () => { competingState = competitor.acquireOrAwait(path); },
    });
    expect(claimant.acquireOrAwait(path)).toBe("unavailable");
    expect(competingState).toBe("owner");
    competitor.release(path);
  });
});

function temporaryRoot(label: string, absent = false): string {
  const parent = mkdtempSync(join(tmpdir(), `dc2d-trace-${label}-`));
  temporaryRoots.push(parent);
  return absent ? join(parent, "absent") : parent;
}

interface TraceEnvelope {
  trace: GeneratedFloorTrace;
  contentFingerprint: string;
}

function corruptTraceArtifact(
  path: string,
  fault: "identity" | "bounds" | "content" | "floor-metadata" | "partial",
): void {
  if (fault === "partial") {
    writeFileSync(path, readFileSync(path).subarray(0, 8));
    return;
  }
  const envelope = deserialize(gunzipSync(readFileSync(path))) as TraceEnvelope;
  if (fault === "identity") mutateTraceIdentity(envelope.trace);
  if (fault === "bounds") mutateTraceBounds(envelope.trace);
  if (fault === "content") mutateTraceContent(envelope.trace);
  if (fault === "floor-metadata") mutateFloorMetadata(envelope.trace);
  if (fault === "bounds") envelope.contentFingerprint = traceContentFingerprint(envelope.trace.trace);
  writeFileSync(path, gzipSync(serialize(envelope)));
}

function mutateTraceIdentity(trace: GeneratedFloorTrace): void {
  (trace.floor as { worldSeed: number }).worldSeed = REQUEST.worldSeed + 1;
}

function mutateTraceBounds(trace: GeneratedFloorTrace): void {
  const floorBounds = trace.floor.bounds as { maxX: number };
  const identityBounds = trace.floor.identity.bounds as { maxX: number };
  const traceBounds = trace.trace.bounds as { maxX: number };
  floorBounds.maxX += 1;
  identityBounds.maxX += 1;
  traceBounds.maxX += 1;
}

function mutateTraceContent(trace: GeneratedFloorTrace): void {
  const snapshot = trace.trace.snapshots[1];
  if (!snapshot) throw new Error("missing trace snapshot");
  const mutableSemantic = snapshot.semantic as Uint8Array;
  mutableSemantic[0] = (mutableSemantic[0] ?? 0) ^ 1;
}

function mutateFloorMetadata(trace: GeneratedFloorTrace): void {
  const spawn = trace.floor.spawn as { x: number };
  spawn.x += 1;
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${label}`);
  return value;
}
