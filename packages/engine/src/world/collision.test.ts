import { describe, expect, it } from "vitest";
import { WorldChunkCache, resolveMovement } from "./collision.js";
import { findChunkPoi } from "./poiStamper.js";
import { GroundKind, PropKind, type ChunkProp } from "./types.js";

function makeFlatObstacleCache(opts: {
  readonly props: readonly ChunkProp[];
  readonly cliffTile?: readonly [number, number];
  readonly waterTile?: readonly [number, number];
}): WorldChunkCache {
  return new (class extends WorldChunkCache {
    override tileAt(wx: number, wy: number) {
      if (opts.cliffTile && Math.floor(wx) === opts.cliffTile[0] && Math.floor(wy) === opts.cliffTile[1]) {
        return { ground: GroundKind.CliffStone, elevation: 1, stairs: false };
      }
      if (opts.waterTile && Math.floor(wx) === opts.waterTile[0] && Math.floor(wy) === opts.waterTile[1]) {
        return { ground: GroundKind.DeepWater, elevation: 0, stairs: false };
      }
      return { ground: GroundKind.Grass, elevation: 0, stairs: false };
    }
    override propsNear() { return opts.props; }
    override poisNear() { return []; }
  })(1337);
}

function stepRepeatedly(opts: {
  readonly cache: WorldChunkCache; readonly startX: number; readonly startY: number;
  readonly dx: number; readonly dy: number; readonly ticks: number;
}): { readonly x: number; readonly y: number } {
  let x = opts.startX;
  let y = opts.startY;
  for (let i = 0; i < opts.ticks; i++) {
    const res = resolveMovement({ cache: opts.cache, x, y, dx: opts.dx, dy: opts.dy, radius: 0.26, elevation: 0 });
    x = res.x;
    y = res.y;
  }
  return { x, y };
}

describe("collision", () => {
  it("slides around deep water and cliff ledges while allowing stair traversal", () => {
    const cache = new WorldChunkCache(1337);
    const open = resolveMovement({
      cache,
      x: 0.5,
      y: 0.5,
      dx: 0.25,
      dy: 0,
      radius: 0.28,
      elevation: 0,
    });
    expect(open.x).toBeGreaterThan(0.5);
    expect(open.elevation).toBe(0);

    // Highland wall at (-8, -8) is elevation 1; stepping into it from south without stairs stops.
    const blockedWall = resolveMovement({
      cache, x: -7.5, y: -6.5, dx: 0, dy: -0.6, radius: 0.25, elevation: 0,
    });
    expect(blockedWall.y).toBe(-6.5);

    // Stepping onto stairs at (-9.5, -5.5) -> (-9.5, -6.5) -> (-9.5, -7.5) succeeds.
    const onStairs = resolveMovement({
      cache,
      x: -9.5,
      y: -5.5,
      dx: 0,
      dy: -0.9,
      radius: 0.25,
      elevation: 0,
    });
    expect(onStairs.y).toBeCloseTo(-6.4, 4);
    const climber = resolveMovement({
      cache,
      x: -9.5,
      y: -6.5,
      dx: 0,
      dy: -0.9,
      radius: 0.25,
      elevation: 0,
    });
    expect(climber.elevation).toBe(1);

    // Approaching south cliff edge (wy = -7 at y = -6.0) stops cleanly at footDepth (0.14).
    const atSouthBase = resolveMovement({ cache, x: -7.5, y: -5.8, dx: 0, dy: -0.5, radius: 0.28, elevation: 0 });
    expect(atSouthBase.y).toBeGreaterThanOrEqual(-5.87);
    expect(atSouthBase.elevation).toBe(0);

    // Approaching north cliff back edge (wy = -13 at y = -13.0) allows standing close behind the rim.
    const atNorthBack = resolveMovement({ cache, x: -7.5, y: -13.2, dx: 0, dy: 0.04, radius: 0.28, elevation: 0 });
    expect(atNorthBack.y).toBeCloseTo(-13.16, 3);

    // Walking grounded south off the raised cliff edge stays blocked.
    const groundedEdge = resolveMovement({ cache, x: -7.5, y: -6.5, dx: 0, dy: 0.9, radius: 0.28, elevation: 1 });
    expect(groundedEdge.elevation).toBe(1);
    expect(groundedEdge.elevationDrop).toBe(0);
    expect(groundedEdge.y).toBeLessThanOrEqual(-6.13);

    // Airborne jumping south off the raised cliff clears the rim and drops to elevation 0.
    const jumpedOff = resolveMovement({ cache, x: -7.5, y: -6.5, dx: 0, dy: 0.9, radius: 0.28, elevation: 1, airborne: true });
    expect(jumpedOff.y).toBeCloseTo(-5.6, 3);
    expect(jumpedOff.elevation).toBe(0);
    expect(jumpedOff.elevationDrop).toBe(1);

    // Low jump height cannot clear a 1-tile cliff wall, while peak jump clears +1 elevation smoothly.
    const blockedLowJump = resolveMovement({
      cache, x: -7.5, y: -5.8, dx: 0, dy: -0.5, radius: 0.28, elevation: 0, airborne: true, jumpZ: 0.15,
    });
    expect(blockedLowJump.y).toBeGreaterThanOrEqual(-5.87);
    expect(blockedLowJump.elevation).toBe(0);

    const jumpedUp = resolveMovement({
      cache, x: -7.5, y: -6.15, dx: 0, dy: -0.6, radius: 0.28, elevation: 0, airborne: true, jumpZ: 0.62,
    });
    expect(jumpedUp.y).toBeCloseTo(-6.75, 3);
    expect(jumpedUp.elevation).toBe(1);
    expect(jumpedUp.elevationDrop).toBe(-1);

    // Jumping against a 2-tile elevation wall stays blocked even at apex height.
    class TallCliffCache extends WorldChunkCache {
      override tileAt(_wx: number, wy: number) {
        return { ground: GroundKind.Grass, elevation: Math.floor(wy) <= -8 ? 2 : 0, stairs: false };
      }
      override propsNear() { return []; }
    }
    const blockedHigh = resolveMovement({
      cache: new TallCliffCache(1337), x: -7.5, y: -6.85, dx: 0, dy: -0.5, radius: 0.28, elevation: 0, airborne: true, jumpZ: 0.65,
    });
    expect(blockedHigh.elevation).toBe(0);
    expect(blockedHigh.y).toBeGreaterThanOrEqual(-6.87);
  });

  it("slows movement in shallow and deep water without blocking", () => {
    const cache = new WorldChunkCache(1337);
    let shallowCoord: { x: number; y: number } | null = null;
    for (let x = 1; x < 30; x++) {
      if (cache.tileAt(x, 0).ground === GroundKind.ShallowWater) {
        shallowCoord = { x: x + 0.5, y: 0.5 };
        break;
      }
    }
    expect(shallowCoord).not.toBeNull();
    if (!shallowCoord) return;
    const res = resolveMovement({
      cache,
      x: shallowCoord.x,
      y: shallowCoord.y,
      dx: 0.05,
      dy: 0,
      radius: 0.2,
      elevation: 0,
    });
    expect(res.inWater).toBe(true);
    expect(res.inDeepWater).toBe(false);
    expect(res.speedMultiplier).toBe(0.78);

    const swimCache = makeFlatObstacleCache({ props: [], waterTile: [5, 5] });
    const deepRes = resolveMovement({
      cache: swimCache,
      x: 5.5,
      y: 5.5,
      dx: 0.05,
      dy: 0,
      radius: 0.2,
      elevation: 0,
    });
    expect(deepRes.inWater).toBe(true);
    expect(deepRes.inDeepWater).toBe(true);
    expect(deepRes.speedMultiplier).toBe(0.56);
    expect(deepRes.x).toBeGreaterThan(5.5);
  });

  it("caps WorldChunkCache with LRU eviction during far exploration", () => {
    const cache = new WorldChunkCache(1337);
    for (let cx = 0; cx < 110; cx++) cache.getChunk(cx, 0);
    expect(cache.size()).toBeLessThanOrEqual(96);
    expect(cache.size()).toBe(96);
  });

  it("never clips through rocks, palisade seams, diagonal corners, or cliff-side boulders at sprint/dodge speed", () => {
    const mk = (o: { id: string; kind: PropKind; x: number; y: number; r: number }): ChunkProp => ({
      id: o.id, kind: o.kind, x: o.x, y: o.y, variant: 0, elevation: 0, radius: o.r, blocksMovement: true,
    });
    const cache = makeFlatObstacleCache({
      props: [
        mk({ id: "boulder", kind: PropKind.Boulder, x: 10, y: 10, r: 0.42 }),
        mk({ id: "pal-a", kind: PropKind.Palisade, x: 20, y: 10, r: 0.5 }),
        mk({ id: "pal-b", kind: PropKind.Palisade, x: 21, y: 10, r: 0.5 }),
        mk({ id: "diag-a", kind: PropKind.Palisade, x: 30, y: 10, r: 0.5 }),
        mk({ id: "diag-b", kind: PropKind.Palisade, x: 31, y: 11, r: 0.5 }),
        mk({ id: "pinch-boulder", kind: PropKind.Boulder, x: 40.3, y: 10.5, r: 0.42 }),
      ],
      cliffTile: [41, 10],
    });
    expect(stepRepeatedly({ cache, startX: 10, startY: 11.4, dx: 0, dy: -0.55, ticks: 40 }).y).toBeGreaterThan(10.65);
    expect(stepRepeatedly({ cache, startX: 20.5, startY: 11.4, dx: 0, dy: -0.53, ticks: 40 }).y).toBeGreaterThan(10.45);
    const diag = stepRepeatedly({ cache, startX: 30.85, startY: 9.8, dx: -0.35, dy: 0.35, ticks: 35 });
    expect(diag.x > 29.8 || diag.y < 10.6).toBe(true);
    const pinch = stepRepeatedly({ cache, startX: 40.9, startY: 9.8, dx: 0, dy: 0.35, ticks: 25 });
    expect(pinch.x).toBeLessThan(41);
    expect(Math.hypot(pinch.x - 40.3, pinch.y - 10.5)).toBeGreaterThanOrEqual(0.66);
  });

  it("blocks movement at POI chests, campfires, and dual-circle tent footprints", () => {
    const cache = new WorldChunkCache(1337);
    const poi = findChunkPoi(1337, 1, 0);
    expect(poi).not.toBeNull();
    if (!poi) return;
    const chestRes = stepRepeatedly({ cache, startX: poi.chestX, startY: poi.chestY + 1.2, dx: 0, dy: -0.35, ticks: 20 });
    expect(Math.hypot(chestRes.x - poi.chestX, chestRes.y - (poi.chestY - 0.14))).toBeGreaterThanOrEqual(0.7);

    const fireRes = stepRepeatedly({ cache, startX: poi.centerX, startY: poi.centerY + 2.0, dx: 0, dy: -0.35, ticks: 20 });
    expect(Math.hypot(fireRes.x - poi.centerX, fireRes.y - (poi.centerY + 0.8))).toBeGreaterThanOrEqual(0.72);

    const tent = cache.propsNear(poi.centerX, poi.centerY).find((p) => p.kind === PropKind.Tent);
    expect(tent).toBeDefined();
    if (!tent) return;
    const tentCenter = stepRepeatedly({ cache, startX: tent.x + 0.36, startY: tent.y + 1.2, dx: 0, dy: -0.35, ticks: 20 });
    expect(tentCenter.y).toBeGreaterThanOrEqual(tent.y + 0.55);
    const tentSlide = stepRepeatedly({ cache, startX: tent.x + 0.4, startY: tent.y + 1.2, dx: 0, dy: -0.35, ticks: 20 });
    expect(Math.hypot(tentSlide.x - (tent.x + 0.36), tentSlide.y - (tent.y - 0.24))).toBeGreaterThanOrEqual(0.8);
  });
});
