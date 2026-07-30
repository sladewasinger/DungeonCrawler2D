import {
  CHUNK_SIZE,
  MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
  World,
  hashString,
  miniBossArenaAtPosition,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { wrapDegrees } from "../../../../render/view/orientation/viewOrientation.js";
import {
  CompassLandmarkLocator,
  resolveCompassLandmarks,
} from "./compassLandmarks.js";
import { findNearestCompassLandmarks } from "./compassLandmarkSearch.js";
import {
  arenaChunkKey,
  nearestMiniBossArena,
} from "./miniBossCompassSearch.js";

const WORLD_SEED = hashString("ordinary-mini-boss-arena");
const MISSING_ARENA_ERROR = "test world is missing a mini-boss arena";

describe("compass landmarks", () => {
  it("finds production-stamped landmarks without generating compass chunks", () => {
    const world = new World(WORLD_SEED, 1);
    const positions = findNearestCompassLandmarks({
      world,
      x: 0.5,
      y: 0.5,
    });

    expect(positions.safeRoom).not.toBeNull();
    expect(positions.miniBossArena).not.toBeNull();
    expect(world.cachedChunkCount).toBe(0);
    const arena = positions.miniBossArena;
    expect(arena && miniBossArenaAtPosition(world, arena.x, arena.y))
      .not.toBeNull();
  });

  it("composes landmark bearings with the current camera orientation", () => {
    const world = new World(WORLD_SEED, 1);
    const locator = new CompassLandmarkLocator();
    const northUp = locator.resolve({ world, x: 0.5, y: 0.5, viewBearingDeg: 0 });
    const westUp = locator.resolve({ world, x: 0.5, y: 0.5, viewBearingDeg: 90 });
    if (!northUp.safeRoom || !northUp.miniBossArena || !westUp.safeRoom || !westUp.miniBossArena) {
      throw new Error("test world is missing a compass landmark");
    }

    expect(westUp.safeRoom.screenBearingDeg).toBeCloseTo(
      (northUp.safeRoom.screenBearingDeg + 90) % 360,
      6,
    );
    expect(westUp.miniBossArena.screenBearingDeg).toBeCloseTo(
      (northUp.miniBossArena.screenBearingDeg + 90) % 360,
      6,
    );
  });

  it("reselects the nearest mini-boss arena while moving within a chunk", () => {
    const world = new World(WORLD_SEED, 1);
    const locator = new CompassLandmarkLocator();
    const before = { x: -255.5, y: -176 };
    const after = { x: -255.5, y: -160.5 };
    const beforeTarget = nearestMiniBossArena({ world, ...before });
    const afterTarget = nearestMiniBossArena({ world, ...after });
    if (!beforeTarget || !afterTarget) throw new Error(MISSING_ARENA_ERROR);
    expect(samePosition(beforeTarget, afterTarget)).toBe(false);

    const beforeMarker = locator.resolve({ world, ...before, viewBearingDeg: 0 });
    const afterMarker = locator.resolve({ world, ...after, viewBearingDeg: 0 });

    expect(beforeMarker.miniBossArena?.screenBearingDeg).toBe(
      bearingTo(before, beforeTarget),
    );
    expect(afterMarker.miniBossArena?.screenBearingDeg).toBe(
      bearingTo(after, afterTarget),
    );
    expect(afterMarker.miniBossArena).not.toEqual(beforeMarker.miniBossArena);
  });

  it("hides the mini-boss bearing on the final boss floor", () => {
    const targets = resolveCompassLandmarks({
      world: new World(WORLD_SEED, 5),
      x: 0.5,
      y: 0.5,
      viewBearingDeg: 0,
    });

    expect(targets.miniBossArena).toBeNull();
  });

  it("excludes authoritative defeated arenas without moving the safe-room marker", () => {
    const world = new World(WORLD_SEED, 1);
    const locator = new CompassLandmarkLocator();
    const x = 0.5;
    const y = 0.5;
    const active = nearestMiniBossArena({ world, x, y });
    if (!active) throw new Error(MISSING_ARENA_ERROR);
    const defeated = new Set([
      arenaChunkKey(
        Math.floor(active.x / CHUNK_SIZE),
        Math.floor(active.y / CHUNK_SIZE),
      ),
    ]);
    const replacement = nearestMiniBossArena({
      world,
      x,
      y,
      defeatedArenaChunks: defeated,
    });
    if (!replacement) throw new Error("test world is missing a second mini-boss arena");

    const before = locator.resolve({ world, x, y, viewBearingDeg: 0 });
    const after = locator.resolve({
      world,
      x,
      y,
      viewBearingDeg: 0,
      defeatedMiniBossArenaChunks: defeated,
      miniBossArenaLandmarkRevision: 1,
    });

    expect(after.safeRoom).toEqual(before.safeRoom);
    expect(after.miniBossArena).not.toEqual(before.miniBossArena);
  });

  it("does not reveal an arena newly exposed by predicted chunk movement", () => {
    const world = new World(WORLD_SEED, 1);
    const active = nearestMiniBossArena({ world, x: 0.5, y: 0.5 });
    if (!active) throw new Error(MISSING_ARENA_ERROR);
    const arenaChunk = {
      cx: Math.floor(active.x / CHUNK_SIZE),
      cy: Math.floor(active.y / CHUNK_SIZE),
    };
    const predictedCenter = {
      cx: arenaChunk.cx - MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
      cy: arenaChunk.cy,
    };
    const target = nearestMiniBossArena({
      world,
      x: predictedCenter.cx * CHUNK_SIZE + 0.5,
      y: predictedCenter.cy * CHUNK_SIZE + 0.5,
      windowCenter: {
        cx: predictedCenter.cx - 1,
        cy: predictedCenter.cy,
      },
    });

    expect(target).not.toEqual(active);
  });
});

function samePosition(
  left: { readonly x: number; readonly y: number } | null,
  right: { readonly x: number; readonly y: number } | null,
): boolean {
  return left?.x === right?.x && left?.y === right?.y;
}

function bearingTo(
  point: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): number {
  const worldBearingDeg = Math.atan2(target.x - point.x, point.y - target.y) * 180 / Math.PI;
  return wrapDegrees(worldBearingDeg);
}
