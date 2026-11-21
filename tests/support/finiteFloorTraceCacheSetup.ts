import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";
import { gzipSync, gunzipSync } from "node:zlib";
import { createFiniteFloorArtifact } from "../../packages/engine/src/world/generate/artifact/finiteFloorArtifact.js";
import { hashString } from "../../packages/engine/src/core/rng.js";
import {
  installFiniteFloorTraceCache,
  type FiniteFloorTraceCache,
  type FiniteFloorTraceCacheRequest,
  type GeneratedFloorTrace,
} from "../../packages/engine/src/world/generate/finiteFloor.js";
import { floorConfigurationFingerprint } from "../../packages/engine/src/world/generate/config/floorGenerationConfig.js";
import { FiniteFloorRuntimeLease } from "./finiteFloorRuntimeLease.js";
import { assertTraceIdentity, traceContentFingerprint } from "./finiteFloorTraceValidation.js";
import { immutableTrace } from "./finiteFloorTraceImmutable.js";

const TRACE_CACHE_VERSION = 7;

interface SerializedTraceArtifact {
  readonly trace: GeneratedFloorTrace;
  readonly contentFingerprint: string;
  readonly floorContentFingerprint: string;
}
const TRACE_CACHE_ROOT = join(tmpdir(), "dc2d-vitest-finite-trace");

class FiniteFloorTraceArtifactCache implements FiniteFloorTraceCache {
  private readonly memory = new Map<string, GeneratedFloorTrace>();
  private readonly lease = new FiniteFloorRuntimeLease();

  constructor(private readonly root: string) {}

  read(request: FiniteFloorTraceCacheRequest): GeneratedFloorTrace | null {
    const key = traceCacheKey(request);
    const memory = this.memory.get(key);
    if (memory) return cloneTraceResult(memory);
    const path = traceCachePath(request, this.root);
    const disk = readTrace(path, request);
    if (disk) return this.rememberAndClone(key, disk.trace);
    const leaseState = this.lease.acquireOrAwait(path, () => readTrace(path, request) !== null);
    if (leaseState !== "peer-complete") return null;
    const peer = readTrace(path, request);
    return peer ? this.rememberAndClone(key, peer.trace) : null;
  }

  write(request: FiniteFloorTraceCacheRequest, trace: GeneratedFloorTrace): void {
    const key = traceCacheKey(request);
    const path = traceCachePath(request, this.root);
    let temporary = "";
    try {
      assertTraceIdentity(trace, request);
      const canonical = canonicalTrace(trace);
      this.memory.set(key, canonical);
      mkdirSync(this.root, { recursive: true });
      temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      const artifact: SerializedTraceArtifact = {
        trace,
        contentFingerprint: traceContentFingerprint(trace.trace),
        floorContentFingerprint: traceFloorContentFingerprint(trace),
      };
      writeFileSync(temporary, gzipSync(serialize(artifact)), { flag: "wx" });
      renameSync(temporary, path);
    } catch {
      if (temporary && existsSync(temporary)) unlinkSync(temporary);
    } finally {
      this.lease.release(path);
    }
  }

  private rememberAndClone(key: string, trace: GeneratedFloorTrace): GeneratedFloorTrace {
    const canonical = canonicalTrace(trace);
    this.memory.set(key, canonical);
    return cloneTraceResult(canonical);
  }
}

export function createFiniteFloorTraceCache(root = TRACE_CACHE_ROOT): FiniteFloorTraceCache {
  return new FiniteFloorTraceArtifactCache(root);
}

export function finiteFloorTraceCachePath(request: FiniteFloorTraceCacheRequest, root = TRACE_CACHE_ROOT): string {
  return traceCachePath(request, root);
}

installFiniteFloorTraceCache(createFiniteFloorTraceCache());

function traceCacheKey(request: FiniteFloorTraceCacheRequest): string {
  return [
    `v${TRACE_CACHE_VERSION}`, `generator${request.config.generatorVersion}`, `seed${request.worldSeed}`,
    `floor${request.floor}`, `void${Number(request.voidTerrain)}`,
    `config${floorConfigurationFingerprint(request.config)}`,
  ].join("-");
}

function traceCachePath(request: FiniteFloorTraceCacheRequest, root: string): string {
  return join(root, `${traceCacheKey(request)}.bin.gz`);
}

function readTrace(path: string, request: FiniteFloorTraceCacheRequest): SerializedTraceArtifact | null {
  if (!existsSync(path)) return null;
  try {
    const artifact = deserialize(gunzipSync(readFileSync(path))) as SerializedTraceArtifact;
    if (artifact.contentFingerprint !== traceContentFingerprint(artifact.trace.trace)) return null;
    if (artifact.floorContentFingerprint !== traceFloorContentFingerprint(artifact.trace)) return null;
    assertTraceIdentity(artifact.trace, request, artifact.contentFingerprint);
    return artifact;
  } catch {
    return null;
  }
}

function canonicalTrace(trace: GeneratedFloorTrace): GeneratedFloorTrace {
  return { floor: structuredClone(trace.floor), trace: immutableTrace(trace.trace) };
}

function cloneTraceResult(trace: GeneratedFloorTrace): GeneratedFloorTrace {
  return { floor: structuredClone(trace.floor), trace: trace.trace };
}

function traceFloorContentFingerprint(trace: GeneratedFloorTrace): string {
  const artifact = createFiniteFloorArtifact(trace.floor, encodePlane);
  return hashString(JSON.stringify(artifact)).toString(16);
}

function encodePlane(plane: ArrayBufferView): string {
  return Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength).toString("base64");
}
