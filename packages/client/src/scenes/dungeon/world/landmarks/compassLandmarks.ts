import {
  CHUNK_SIZE,
  type World,
} from "@dc2d/engine";
import { wrapDegrees } from "../../../../render/view/orientation/viewOrientation.js";
import type { CompassLandmarkTicks } from "../../../../ui/widgets/hud/core/fakeData.js";
import {
  emptyCompassLandmarkCandidates,
  findCompassLandmarkCandidates,
  type CompassLandmarkCandidates,
} from "./compassLandmarkCandidates.js";
import {
  type CompassLandmarkPosition,
  type CompassLandmarkPositions,
} from "./compassLandmarkSearch.js";
import { nearestLandmark } from "./compassLandmarkMath.js";

export interface CompassLandmarkRequest {
  readonly world: World;
  readonly x: number;
  readonly y: number;
  readonly viewBearingDeg: number;
  readonly defeatedMiniBossArenaChunks?: ReadonlySet<string>;
  readonly miniBossArenaWindowCenter?: { readonly cx: number; readonly cy: number };
  readonly miniBossArenaLandmarkRevision?: number;
}

/**
 * Locates static map landmarks from the same seed-derived World already held by the
 * client. It never reads remote enemies or extends the server's AOI payload.
 */
export class CompassLandmarkLocator {
  private chunkX = Number.NaN;
  private chunkY = Number.NaN;
  private miniBossWindowChunkX = Number.NaN;
  private miniBossWindowChunkY = Number.NaN;
  private miniBossArenaLandmarkRevision = Number.NaN;
  private candidates: CompassLandmarkCandidates =
    emptyCompassLandmarkCandidates();

  resolve(request: CompassLandmarkRequest): CompassLandmarkTicks {
    if (this.needsRefresh(request)) this.refresh(request);
    return projectLandmarks(request, nearestCompassLandmarks(request, this.candidates));
  }

  private needsRefresh(request: CompassLandmarkRequest): boolean {
    const miniBossCenter = miniBossWindowCenter(request);
    return this.chunkX !== Math.floor(request.x / CHUNK_SIZE) ||
      this.chunkY !== Math.floor(request.y / CHUNK_SIZE) ||
      this.miniBossWindowChunkX !== miniBossCenter.cx ||
      this.miniBossWindowChunkY !== miniBossCenter.cy ||
      this.miniBossArenaLandmarkRevision !==
        (request.miniBossArenaLandmarkRevision ?? 0);
  }

  private refresh(request: CompassLandmarkRequest): void {
    this.chunkX = Math.floor(request.x / CHUNK_SIZE);
    this.chunkY = Math.floor(request.y / CHUNK_SIZE);
    const miniBossCenter = miniBossWindowCenter(request);
    this.miniBossWindowChunkX = miniBossCenter.cx;
    this.miniBossWindowChunkY = miniBossCenter.cy;
    this.miniBossArenaLandmarkRevision =
      request.miniBossArenaLandmarkRevision ?? 0;
    this.candidates = findCompassLandmarkCandidates(request);
  }
}

function miniBossWindowCenter(
  request: CompassLandmarkRequest,
): { readonly cx: number; readonly cy: number } {
  return request.miniBossArenaWindowCenter ?? {
    cx: Math.floor(request.x / CHUNK_SIZE),
    cy: Math.floor(request.y / CHUNK_SIZE),
  };
}

const locators = new WeakMap<World, CompassLandmarkLocator>();

export function resolveCompassLandmarks(
  request: CompassLandmarkRequest,
): CompassLandmarkTicks {
  const locator = locators.get(request.world) ?? new CompassLandmarkLocator();
  locators.set(request.world, locator);
  return locator.resolve(request);
}

function projectLandmarks(
  request: CompassLandmarkRequest,
  positions: CompassLandmarkPositions,
): CompassLandmarkTicks {
  return {
    safeRoom: projectPosition(request, positions.safeRoom),
    miniBossArena: projectPosition(request, positions.miniBossArena),
  };
}

function projectPosition(
  request: CompassLandmarkRequest,
  target: CompassLandmarkPosition | null,
): { readonly screenBearingDeg: number } | null {
  if (!target) return null;
  const worldBearingDeg = Math.atan2(target.x - request.x, request.y - target.y) * 180 / Math.PI;
  return { screenBearingDeg: wrapDegrees(request.viewBearingDeg + worldBearingDeg) };
}

function nearestCompassLandmarks(
  request: CompassLandmarkRequest,
  candidates: CompassLandmarkCandidates,
): CompassLandmarkPositions {
  return {
    safeRoom: nearestLandmark({
      positions: candidates.safeRoom,
      x: request.x,
      y: request.y,
    }),
    miniBossArena: nearestLandmark({
      positions: candidates.miniBossArena,
      x: request.x,
      y: request.y,
    }),
  };
}
