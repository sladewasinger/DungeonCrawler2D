import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearFiniteFloorCache,
  finiteFloorForRuntime,
  installFiniteFloorRuntimeCache,
  normalizeFloorGenerationConfig,
} from "../../packages/engine/src/world/generate/finiteFloor.js";
import type { FiniteFloorRuntimeCacheRequest } from "../../packages/engine/src/world/generate/finiteFloor.js";
import {
  createFiniteFloorRuntimeCache,
  finiteFloorRuntimeCachePath,
} from "../support/finiteFloorRuntimeCacheSetup.js";
import { corruptRuntimeArtifact } from "../support/finiteFloorRuntimeCacheTestSupport.js";
import { FiniteFloorRuntimeLease } from "../support/finiteFloorRuntimeLease.js";

const REQUEST: FiniteFloorRuntimeCacheRequest = {
  worldSeed: 74621,
  floor: 1,
  voidTerrain: true,
  config: normalizeFloorGenerationConfig({
    minX: -144,
    minY: -128,
    width: 448,
    height: 384,
    roomTargetCount: 8,
    targetLoopCount: 4,
    connectorSpacing: 2,
  }),
};
const SOURCE = finiteFloorForRuntime(REQUEST);
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("finite floor runtime artifact cache", () => {
  it("separates cold miss, warm memory clones, and warm disk clones", () => {
    const source = SOURCE;
    const root = temporaryRoot("contract", true);
    const cache = createFiniteFloorRuntimeCache(root);
    const coldStart = performance.now();
    expect(cache.read(REQUEST)).toBeNull();
    expect(performance.now() - coldStart).toBeLessThan(1_000);
    cache.write(REQUEST, source);

    const memoryHit = required(cache.read(REQUEST), "runtime memory hit");
    memoryHit.tiles[0] = memoryHit.tiles[0]! ^ 1;
    (memoryHit.rooms as unknown as unknown[]).splice(0);
    const isolated = required(cache.read(REQUEST), "isolated runtime hit");
    expect(isolated.tiles[0]).toBe(source.tiles[0]);
    expect(isolated.rooms).toEqual(source.rooms);

    const diskHit = required(createFiniteFloorRuntimeCache(root).read(REQUEST), "runtime disk hit");
    expect(diskHit.identity.fingerprint).toBe(source.identity.fingerprint);
    expect(diskHit.tiles).not.toBe(source.tiles);
  });

  it.each(["identity", "bounds", "content", "partial"] as const)(
    "rejects an invalid %s artifact",
    (fault) => {
      const source = SOURCE;
      const root = temporaryRoot(`invalid-${fault}`);
      const cache = createFiniteFloorRuntimeCache(root);
      cache.write(REQUEST, source);
      corruptRuntimeArtifact(finiteFloorRuntimeCachePath(REQUEST, root), fault, REQUEST);
      expect(createFiniteFloorRuntimeCache(root).read(REQUEST)).toBeNull();
    },
  );

  it("keeps a successor lease when its stale predecessor releases", () => {
    const path = join(temporaryRoot("lease-takeover"), "artifact");
    const options = { staleMs: -1, ownerIsAlive: () => false };
    const predecessor = new FiniteFloorRuntimeLease(options);
    const successor = new FiniteFloorRuntimeLease(options);
    expect(predecessor.acquireOrAwait(path)).toBe("owner");
    expect(successor.acquireOrAwait(path)).toBe("owner");
    const successorRecord = readFileSync(`${path}.lock`, "utf8");
    predecessor.release(path);
    expect(readFileSync(`${path}.lock`, "utf8")).toBe(successorRecord);
    successor.release(path);
    expect(existsSync(`${path}.lock`)).toBe(false);
  });

  it("awaits a valid peer artifact instead of consuming its partial target", async () => {
    const source = SOURCE;
    const root = temporaryRoot("peer");
    const path = finiteFloorRuntimeCachePath(REQUEST, root);
    const writer = createFiniteFloorRuntimeCache(root);
    writer.write(REQUEST, source);
    const peerSource = join(root, "peer-artifact.gz");
    writeFileSync(peerSource, readFileSync(path));
    writeFileSync(path, readFileSync(path).subarray(0, 8));
    writeFileSync(`${path}.lock`, JSON.stringify({ token: "peer", pid: process.pid, threadId: 0, timestamp: Date.now() }));
    const worker = delayedCopyWorker(peerSource, path);
    try {
      const restored = createFiniteFloorRuntimeCache(root).read(REQUEST);
      expect(restored?.identity.fingerprint).toBe(source.identity.fingerprint);
    } finally {
      await worker.terminate();
    }
  });

  it("retains explicitly uncached runtime determinism", () => {
    const restore = installFiniteFloorRuntimeCache(null);
    try {
      clearFiniteFloorCache();
      const uncached = finiteFloorForRuntime(REQUEST);
      expect(uncached.identity).toEqual(SOURCE.identity);
      expect(uncached.tiles).toEqual(SOURCE.tiles);
    } finally {
      clearFiniteFloorCache();
      restore();
      finiteFloorForRuntime(REQUEST);
    }
  }, 10_000);
});

function temporaryRoot(label: string, absent = false): string {
  const parent = mkdtempSync(join(tmpdir(), `dc2d-runtime-${label}-`));
  temporaryRoots.push(parent);
  return absent ? join(parent, "absent") : parent;
}

function delayedCopyWorker(source: string, target: string): Worker {
  return new Worker(
    "const { workerData } = require('node:worker_threads'); "
      + "const { readFileSync, writeFileSync } = require('node:fs'); "
      + "setTimeout(() => writeFileSync(workerData.target, readFileSync(workerData.source)), 40);",
    { eval: true, workerData: { source, target } },
  );
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${label}`);
  return value;
}
