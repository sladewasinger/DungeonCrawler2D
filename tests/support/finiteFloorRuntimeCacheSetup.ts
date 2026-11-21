import { createFiniteFloorArtifact, restoreFiniteFloorArtifact, type FiniteFloorArtifact } from "../../packages/engine/src/world/generate/artifact/finiteFloorArtifact.js";
import { cloneGeneratedFloor } from "../../packages/engine/src/world/generate/finiteFloorClone.js";
import { DEFAULT_FLOOR_GENERATION_CONFIG, type FloorBounds, type GeneratedFloor } from "../../packages/engine/src/world/generate/finiteFloorTypes.js";
import { floorConfigurationFingerprint } from "../../packages/engine/src/world/generate/config/floorGenerationConfig.js";
import { generatedFloorFingerprint } from "../../packages/engine/src/world/generate/finiteFloorFingerprint.js";
import { installFiniteFloorRuntimeCache, type FiniteFloorRuntimeCache, type FiniteFloorRuntimeCacheRequest } from "../../packages/engine/src/world/generate/finiteFloor.js";
import { hashString, mixSeeds } from "../../packages/engine/src/core/rng.js";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { threadId } from "node:worker_threads";
import { gunzipSync, gzipSync } from "node:zlib";
import { FiniteFloorRuntimeLease } from "./finiteFloorRuntimeLease.js";

const CACHE_VERSION = 3;
const CACHE_ROOT = join(tmpdir(), "dc2d-vitest-finite-floor");
const MAX_KEYS_PER_WORKER = 64;
const MAX_CACHED_CELLS = DEFAULT_FLOOR_GENERATION_CONFIG.width * DEFAULT_FLOOR_GENERATION_CONFIG.height;

export function createFiniteFloorRuntimeCache(root = CACHE_ROOT): FiniteFloorRuntimeCache {
  return new FiniteFloorArtifactCache(root);
}

class FiniteFloorArtifactCache implements FiniteFloorRuntimeCache {
  private readonly seenKeys = new Set<string>();
  private readonly memory = new Map<string, GeneratedFloor>();
  private readonly lease = new FiniteFloorRuntimeLease();

  public constructor(private readonly root: string) {}

  read(request: FiniteFloorRuntimeCacheRequest): GeneratedFloor | null {
    if (!isSupportedRequest(request)) return null;
    const path = finiteFloorRuntimeCachePath(request, this.root);
    const memory = this.memory.get(path);
    if (memory) return cloneGeneratedFloor(memory);
    const cached = readArtifact(path, request);
    if (cached) return this.remember(path, cached);
    const leaseState = this.lease.acquireOrAwait(path, () => readArtifact(path, request) !== null);
    if (leaseState !== "peer-complete") return null;
    const peerResult = readArtifact(path, request);
    return peerResult ? this.remember(path, peerResult) : null;
  }

  write(request: FiniteFloorRuntimeCacheRequest, floor: GeneratedFloor): void {
    const path = finiteFloorRuntimeCachePath(request, this.root);
    let temporary = "";
    try {
      if (!isSupportedRequest(request) || this.seenKeys.size >= MAX_KEYS_PER_WORKER) return;
      if (!matchesRequest(floor, request)) return;
      mkdirSync(this.root, { recursive: true });
      const artifact = createFiniteFloorArtifact(floor, encodePlane);
      const serialized: SerializedRuntimeArtifact = {
        artifact,
        contentFingerprint: runtimeArtifactContentFingerprint(artifact),
      };
      temporary = `${path}.${process.pid}.${threadId}.tmp`;
      writeFileSync(temporary, gzipSync(JSON.stringify(serialized)), { flag: "wx" });
      renameSync(temporary, path);
      this.memory.set(path, cloneGeneratedFloor(floor));
      this.seenKeys.add(path);
    } catch {
      if (existsSync(temporary)) unlinkSync(temporary);
    } finally {
      this.lease.release(path);
    }
  }

  private remember(path: string, floor: GeneratedFloor): GeneratedFloor {
    const canonical = cloneGeneratedFloor(floor);
    this.memory.set(path, canonical);
    this.seenKeys.add(path);
    return cloneGeneratedFloor(canonical);
  }

}

installFiniteFloorRuntimeCache(createFiniteFloorRuntimeCache());

function isSupportedRequest(request: FiniteFloorRuntimeCacheRequest): boolean {
  return request.config.width * request.config.height <= MAX_CACHED_CELLS;
}

export function finiteFloorRuntimeCachePath(
  request: FiniteFloorRuntimeCacheRequest,
  root = CACHE_ROOT,
): string {
  const identity = [
    `v${CACHE_VERSION}`, `generator${request.config.generatorVersion}`, `seed${request.worldSeed}`,
    `floor${request.floor}`, `void${Number(request.voidTerrain)}`,
    `config${floorConfigurationFingerprint(request.config)}`,
  ].join("-");
  return join(root, `${identity}.json.gz`);
}

function matchesRequest(floor: GeneratedFloor, request: FiniteFloorRuntimeCacheRequest): boolean {
  return matchesFloorIdentity(floor, request)
    && matchesFloorBounds(floor, request)
    && floor.identity.fingerprint === generatedFloorFingerprint(floor);
}

function matchesFloorIdentity(floor: GeneratedFloor, request: FiniteFloorRuntimeCacheRequest): boolean {
  return floor.worldSeed === request.worldSeed
    && floor.floor === request.floor
    && floor.voidTerrain === request.voidTerrain
    && floor.identity.seed === mixSeeds(request.worldSeed, request.floor, request.config.generatorVersion)
    && floor.identity.generatorVersion === request.config.generatorVersion
    && floorConfigurationFingerprint(floor.configuration) === floorConfigurationFingerprint(request.config)
    && floor.identity.configurationFingerprint === floorConfigurationFingerprint(request.config);
}

function matchesFloorBounds(floor: GeneratedFloor, request: FiniteFloorRuntimeCacheRequest): boolean {
  const bounds = expectedBounds(request);
  return sameBounds(floor.bounds, bounds) && sameBounds(floor.identity.bounds, bounds);
}

function readArtifact(path: string, request: FiniteFloorRuntimeCacheRequest): GeneratedFloor | null {
  if (!existsSync(path)) return null;
  try {
    const serialized = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as SerializedRuntimeArtifact;
    if (serialized.contentFingerprint !== runtimeArtifactContentFingerprint(serialized.artifact)) return null;
    const restored = restoreFiniteFloorArtifact(serialized.artifact, decodePlane);
    return matchesRequest(restored, request) ? restored : null;
  } catch {
    return null;
  }
}

interface SerializedRuntimeArtifact {
  readonly artifact: FiniteFloorArtifact;
  readonly contentFingerprint: string;
}

export function runtimeArtifactContentFingerprintForTest(artifact: FiniteFloorArtifact): string {
  return runtimeArtifactContentFingerprint(artifact);
}

function runtimeArtifactContentFingerprint(artifact: FiniteFloorArtifact): string {
  return hashString(JSON.stringify(artifact)).toString(16);
}

function expectedBounds(request: FiniteFloorRuntimeCacheRequest): FloorBounds {
  const { minX, minY, width, height } = request.config;
  const maxX = minX + width - 1;
  const maxY = minY + height - 1;
  return {
    minX, minY, width, height, maxX, maxY,
    minChunkX: Math.floor(minX / 32), minChunkY: Math.floor(minY / 32),
    maxChunkX: Math.floor(maxX / 32), maxChunkY: Math.floor(maxY / 32),
  };
}

function sameBounds(left: FloorBounds, right: FloorBounds): boolean {
  return ["minX", "minY", "width", "height", "maxX", "maxY", "minChunkX", "minChunkY", "maxChunkX", "maxChunkY"]
    .every((key) => left[key as keyof FloorBounds] === right[key as keyof FloorBounds]);
}

function encodePlane(plane: ArrayBufferView): string {
  return Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength).toString("base64");
}

function decodePlane(encoded: string): Uint8Array {
  return Uint8Array.from(Buffer.from(encoded, "base64"));
}
