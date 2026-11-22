import {
  cloneGeneratedFloor,
  CHUNK_SIZE,
  createFiniteFloorArtifact,
  DEFAULT_FLOOR_GENERATION_CONFIG,
  FINITE_GENERATOR_VERSION,
  hashString,
  mixSeeds,
  restoreFiniteFloorArtifact,
  finiteFloorForRuntime,
  type FiniteFloorArtifact,
  type GeneratedFloor,
} from "@dc2d/engine";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { threadId } from "node:worker_threads";
import { fingerprintForFloor } from "./finiteFloorFixtureIdentity.js";

const CACHE_VERSION = 2;
const CACHE_ROOT = join(tmpdir(), "dc2d-vitest-finite-floor");
const VOID_TERRAIN = true;
let validatedCacheHits = 0;
const CONFIGURATION_FINGERPRINT = hashString(
  JSON.stringify(DEFAULT_FLOOR_GENERATION_CONFIG),
).toString(16);

/**
 * Loads the real default dungeon fixture while sharing it between isolated
 * Vitest workers. Every caller receives a clone, so tests cannot mutate the
 * cached reconstruction or another test's World.
 */
export function loadIntegrationDungeonFixture(worldSeed: number, floor: number): GeneratedFloor {
  const path = cachePath(worldSeed, floor);
  const cached = readCachedFixture(path, worldSeed, floor);
  if (cached) return cloneGeneratedFloor(cached);

  const generated = finiteFloorForRuntime({
    worldSeed,
    floor,
    features: { voidTerrain: VOID_TERRAIN },
  });
  writeCachedFixture(path, generated);
  return cloneGeneratedFloor(generated);
}

export function integrationDungeonFixtureCacheHits(): number {
  return validatedCacheHits;
}

function cachePath(worldSeed: number, floor: number): string {
  const identity = [
    `v${CACHE_VERSION}`,
    `generator${FINITE_GENERATOR_VERSION}`,
    `seed${worldSeed}`,
    `floor${floor}`,
    `void${Number(VOID_TERRAIN)}`,
    `config${CONFIGURATION_FINGERPRINT}`,
  ].join("-");
  return join(CACHE_ROOT, `${identity}.json.gz`);
}

function readCachedFixture(path: string, worldSeed: number, expectedFloor: number): GeneratedFloor | null {
  if (!existsSync(path)) return null;
  try {
    const json = gunzipSync(readFileSync(path)).toString("utf8");
    const artifact = JSON.parse(json) as FiniteFloorArtifact;
    const restored = restoreFiniteFloorArtifact(artifact, decodePlane);
    if (!isExpectedFixture(restored, worldSeed, expectedFloor)) return null;
    validatedCacheHits += 1;
    return restored;
  } catch {
    return null;
  }
}

function isExpectedFixture(floor: GeneratedFloor, worldSeed: number, expectedFloor: number): boolean {
  return matchesRequestedIdentity(floor, worldSeed, expectedFloor)
    && matchesFixtureBounds(floor)
    && matchesFingerprint(floor);
}

function matchesRequestedIdentity(floor: GeneratedFloor, worldSeed: number, expectedFloor: number): boolean {
  return floor.worldSeed === worldSeed
    && floor.floor === expectedFloor
    && floor.voidTerrain === VOID_TERRAIN
    && floor.identity.seed === mixSeeds(worldSeed, expectedFloor, FINITE_GENERATOR_VERSION)
    && floor.identity.generatorVersion === FINITE_GENERATOR_VERSION
    && floor.identity.configurationFingerprint === CONFIGURATION_FINGERPRINT;
}

function matchesFixtureBounds(floor: GeneratedFloor): boolean {
  const expectedBounds = defaultFixtureBounds();
  return sameBounds(floor.bounds, expectedBounds) && sameBounds(floor.identity.bounds, expectedBounds);
}

function matchesFingerprint(floor: GeneratedFloor): boolean {
  return floor.identity.fingerprint === fingerprintForFloor(floor);
}

function defaultFixtureBounds(): GeneratedFloor["bounds"] {
  const config = DEFAULT_FLOOR_GENERATION_CONFIG;
  const maxX = config.minX + config.width - 1;
  const maxY = config.minY + config.height - 1;
  return {
    minX: config.minX, minY: config.minY, width: config.width, height: config.height,
    maxX, maxY,
    minChunkX: Math.floor(config.minX / CHUNK_SIZE),
    minChunkY: Math.floor(config.minY / CHUNK_SIZE),
    maxChunkX: Math.floor(maxX / CHUNK_SIZE),
    maxChunkY: Math.floor(maxY / CHUNK_SIZE),
  };
}

function sameBounds(expected: GeneratedFloor["bounds"], actual: GeneratedFloor["bounds"]): boolean {
  const actualValues = boundsValues(actual);
  return boundsValues(expected).every((value, index) => value === actualValues[index]);
}

function boundsValues(bounds: GeneratedFloor["bounds"]): number[] {
  return [
    bounds.minX, bounds.minY, bounds.width, bounds.height, bounds.maxX,
    bounds.maxY, bounds.minChunkX, bounds.minChunkY, bounds.maxChunkX, bounds.maxChunkY,
  ];
}

function writeCachedFixture(path: string, floor: GeneratedFloor): void {
  try {
    mkdirSync(CACHE_ROOT, { recursive: true });
    const artifact = createFiniteFloorArtifact(floor, encodePlane);
    const payload = gzipSync(JSON.stringify(artifact));
    const temporary = `${path}.${process.pid}.${threadId}.tmp`;
    writeFileSync(temporary, payload, { flag: "wx" });
    renameSync(temporary, path);
  } catch (error) {
    const temporary = `${path}.${process.pid}.${threadId}.tmp`;
    if (existsSync(temporary)) unlinkSync(temporary);
    if (error instanceof Error && error.message.includes("EACCES")) return;
  }
}

function encodePlane(plane: ArrayBufferView): string {
  return Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength).toString("base64");
}

function decodePlane(encoded: string): Uint8Array {
  return Uint8Array.from(Buffer.from(encoded, "base64"));
}
