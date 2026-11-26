import { describe, expect, it } from "vitest";
import { COMBAT_TUNING } from "../combat/combatRules.js";
import { playerFootSegment } from "../combat/hitboxes/combatShapes.js";
import { WorldChunkCache, resolveMovement } from "./collision.js";
import { findChunkPoi } from "./poiStamper.js";
import {
  POI_CHEST_OBSTACLE_SHAPE,
  closestObstacleCorePoint,
  propCollisionOffsetY,
  propFootprintCenter,
} from "./propFootprints.js";
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
  const { collisionRadiusTiles, footHalfWidthTiles } = COMBAT_TUNING.movement;
  for (let i = 0; i < opts.ticks; i++) {
    const res = resolveMovement({
      cache: opts.cache, x, y, dx: opts.dx, dy: opts.dy,
      radius: collisionRadiusTiles, footHalfX: footHalfWidthTiles, elevation: 0,
    });
    x = res.x;
    y = res.y;
  }
  return { x, y };
}

describe("collision", () => {
  it("slides around deep water and cliff ledges while allowing stair traversal", () => {
    const cache = new WorldChunkCache(1337);
    const open = resolveMovement({ cache, x: 0.5, y: 0.5, dx: 0.25, dy: 0, radius: 0.28, elevation: 0 });
    expect(open.x).toBeGreaterThan(0.5);
    expect(open.elevation).toBe(0);

    // Highland wall at (-8, -8) is elevation 1; stepping into it from south without stairs stops.
    const blockedWall = resolveMovement({ cache, x: -7.5, y: -6.5, dx: 0, dy: -0.6, radius: 0.25, elevation: 0 });
    expect(blockedWall.y).toBe(-6.5);

    // Stepping onto stairs at (-9.5, -5.5) -> (-9.5, -6.5) -> (-9.5, -7.5) succeeds.
    const onStairs = resolveMovement({ cache, x: -9.5, y: -5.5, dx: 0, dy: -0.9, radius: 0.25, elevation: 0 });
    expect(onStairs.y).toBeCloseTo(-6.4, 4);
    const climber = resolveMovement({ cache, x: -9.5, y: -6.5, dx: 0, dy: -0.9, radius: 0.25, elevation: 0 });
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
    const res = resolveMovement({ cache, x: shallowCoord.x, y: shallowCoord.y, dx: 0.05, dy: 0, radius: 0.2, elevation: 0 });
    expect(res.inWater).toBe(true);
    expect(res.inDeepWater).toBe(false);
    expect(res.speedMultiplier).toBe(0.78);

    const swimCache = makeFlatObstacleCache({ props: [], waterTile: [5, 5] });
    const deepRes = resolveMovement({ cache: swimCache, x: 5.5, y: 5.5, dx: 0.05, dy: 0, radius: 0.2, elevation: 0 });
    expect(deepRes.inWater).toBe(true);
    expect(deepRes.inDeepWater).toBe(true);
    expect(deepRes.speedMultiplier).toBe(0.56);
    expect(deepRes.x).toBeGreaterThan(5.5);
  });

  it("caps WorldChunkCache with LRU eviction during far exploration and invalidates cached obstacles on deltas", () => {
    const cache = new WorldChunkCache(1337);
    const firstChunk = cache.getChunk(0, 0);
    expect(cache.getChunk(0, 0)).toBe(firstChunk);
    const structId = "struct-test";
    expect(cache.blockingObstaclesNear(5.5, 5.5).some((o) => o.id === structId)).toBe(false);
    cache.addPlacedStructure({ id: structId, kind: "palisade", itemId: "palisade", x: 5.5, y: 5.5, elevation: 0, ownerName: "Scout" });
    expect(cache.blockingObstaclesNear(5.5, 5.5).some((o) => o.id === structId)).toBe(true);
    cache.removePlacedStructure(structId);
    expect(cache.blockingObstaclesNear(5.5, 5.5).some((o) => o.id === structId)).toBe(false);
    for (let cx = 0; cx < 270; cx++) cache.getChunk(cx, 0);
    expect(cache.size()).toBeLessThanOrEqual(256);
    expect(cache.size()).toBe(256);

    const smallCache = new WorldChunkCache(1337, { maxCachedChunks: 24 });
    for (let cx = 0; cx < 40; cx++) smallCache.getChunk(cx, 0);
    expect(smallCache.size()).toBe(24);
  });

  it("never clips through rocks, palisade seams, diagonal corners, or cliff-side boulders at sprint/dodge speed", () => {
    const mk = (o: { id: string; kind: PropKind; x: number; y: number; r: number; elevation?: number }): ChunkProp => ({
      id: o.id, kind: o.kind, x: o.x, y: o.y, variant: 0, elevation: o.elevation ?? 0, radius: o.r, blocksMovement: true,
    });
    const boulder = mk({ id: "boulder", kind: PropKind.Boulder, x: 10, y: 10, r: 0.42 });
    const palA = mk({ id: "pal-a", kind: PropKind.Palisade, x: 20, y: 10, r: 0.5 });
    const pinchBoulder = mk({ id: "pinch-boulder", kind: PropKind.Boulder, x: 40.3, y: 10.5, r: 0.42 });
    const cache = makeFlatObstacleCache({
      props: [
        boulder, palA,
        mk({ id: "pal-b", kind: PropKind.Palisade, x: 21, y: 10, r: 0.5 }),
        mk({ id: "diag-a", kind: PropKind.Palisade, x: 30, y: 10, r: 0.5 }),
        mk({ id: "diag-b", kind: PropKind.Palisade, x: 31, y: 11, r: 0.5 }),
        pinchBoulder,
        mk({ id: "high-boulder", kind: PropKind.Boulder, x: 50, y: 10, r: 0.42, elevation: 2 }),
      ],
      cliffTile: [41, 10],
    });
    const boulderSouth = stepRepeatedly({ cache, startX: 10, startY: 11.4, dx: 0, dy: -0.55, ticks: 40 });
    const bCenter = propFootprintCenter(boulder);
    expect(boulderSouth.y).toBeGreaterThanOrEqual(bCenter.y + 0.57);
    expect(boulderSouth.y).toBeLessThan(boulder.y + boulder.radius + COMBAT_TUNING.movement.collisionRadiusTiles);

    const palCenter = propFootprintCenter(palA);
    const seamRes = stepRepeatedly({ cache, startX: 20.5, startY: 11.4, dx: 0, dy: -0.53, ticks: 40 });
    expect(seamRes.y).toBeGreaterThanOrEqual(palCenter.y + 0.49);

    const diag = stepRepeatedly({ cache, startX: 30.85, startY: 9.8, dx: -0.35, dy: 0.35, ticks: 35 });
    expect(diag.x > 29.8 || diag.y < 10.6).toBe(true);

    const pinch = stepRepeatedly({ cache, startX: 40.9, startY: 9.8, dx: 0, dy: 0.35, ticks: 25 });
    const pinchCenter = propFootprintCenter(pinchBoulder);
    const pinchObs = { id: "pinch", x: pinchCenter.x, y: pinchCenter.y, radius: pinchBoulder.radius, elevation: 0 };
    const pinchCore = closestObstacleCorePoint(pinchObs, {
      x: pinch.x, y: pinch.y, halfX: COMBAT_TUNING.movement.footHalfWidthTiles,
    });
    expect(pinch.x).toBeLessThan(41);
    expect(Math.hypot(pinch.x - pinchCore.x, pinch.y - pinchCore.y)).toBeGreaterThanOrEqual(0.57);

    const highObs = cache.blockingObstaclesNear(50, 10).find((obs) => obs.id === "high-boulder");
    expect(highObs?.elevation).toBe(2);
  });

  it("blocks movement at POI chests, campfires, and capsule tent footprints", () => {
    const cache = new WorldChunkCache(1337);
    const poi = findChunkPoi(1337, 1, 0);
    expect(poi).not.toBeNull();
    if (!poi) return;
    const chestRes = stepRepeatedly({ cache, startX: poi.chestX, startY: poi.chestY + 1.2, dx: 0, dy: -0.35, ticks: 20 });
    expect(chestRes.y).toBeGreaterThanOrEqual(poi.chestY + POI_CHEST_OBSTACLE_SHAPE.offsetY + 0.35);

    const fireY = poi.centerY + 0.8 + propCollisionOffsetY(PropKind.Campfire);
    const fireRes = stepRepeatedly({ cache, startX: poi.centerX, startY: poi.centerY + 2.0, dx: 0, dy: -0.35, ticks: 20 });
    expect(Math.hypot(fireRes.x - poi.centerX, fireRes.y - fireY)).toBeGreaterThanOrEqual(0.85);

    const tent = cache.propsNear(poi.centerX, poi.centerY).find((p) => p.kind === PropKind.Tent);
    expect(tent).toBeDefined();
    if (!tent) return;
    const tentCenter = stepRepeatedly({ cache, startX: tent.x + 0.36, startY: tent.y + 1.2, dx: 0, dy: -0.35, ticks: 20 });
    expect(tentCenter.y).toBeGreaterThanOrEqual(tent.y + 0.47);
    const tentObs = cache.blockingObstaclesNear(tent.x, tent.y).find((obs) => obs.id === tent.id);
    expect(tentObs?.halfX).toBeGreaterThan(0);
    if (!tentObs) return;
    const tentSlide = stepRepeatedly({ cache, startX: tent.x + 0.4, startY: tent.y + 1.2, dx: 0, dy: -0.35, ticks: 20 });
    const tentCore = closestObstacleCorePoint(tentObs, {
      x: tentSlide.x, y: tentSlide.y, halfX: COMBAT_TUNING.movement.footHalfWidthTiles,
    });
    expect(Math.hypot(tentSlide.x - tentCore.x, tentSlide.y - tentCore.y)).toBeGreaterThanOrEqual(0.71);
  });

  it("lets sideways-facing player capsule strafe through narrow E-W gaps and nudges out on stationary turns", () => {
    const mk = (o: { id: string; kind: PropKind; x: number; y: number }): ChunkProp => ({
      id: o.id, kind: o.kind, x: o.x, y: o.y, variant: 0, elevation: 0, radius: 0.42, blocksMovement: true,
    });
    const gapCache = makeFlatObstacleCache({
      props: [
        mk({ id: "gL", kind: PropKind.Boulder, x: 59.37, y: 10 }),
        mk({ id: "gR", kind: PropKind.Boulder, x: 60.63, y: 10 }),
        mk({ id: "pal", kind: PropKind.Palisade, x: 70, y: 10 }),
      ],
    });
    const southSeg = playerFootSegment({ facingX: 0, facingY: 1 });
    let sy = 10.6;
    for (let i = 0; i < 20; i++) {
      sy = resolveMovement({
        cache: gapCache, x: 60, y: sy, dx: 0, dy: -0.06, radius: 0.17,
        footSegX: southSeg.segX, footSegY: southSeg.segY, elevation: 0,
      }).y;
    }
    expect(sy).toBeGreaterThan(9.9);

    const eastSeg = playerFootSegment({ facingX: 1, facingY: 0 });
    let ey = 10.6;
    for (let i = 0; i < 24; i++) {
      ey = resolveMovement({
        cache: gapCache, x: 60, y: ey, dx: 0, dy: -0.06, radius: 0.17,
        footSegX: eastSeg.segX, footSegY: eastSeg.segY, elevation: 0,
      }).y;
    }
    expect(ey).toBeLessThan(9.4);

    const turned = resolveMovement({
      cache: gapCache, x: 69.30, y: 9.78, dx: 0, dy: 0, radius: 0.17,
      footSegX: southSeg.segX, footSegY: southSeg.segY, elevation: 0,
    });
    expect(turned.x).toBeLessThanOrEqual(69.205);
  });

  it("ignores blocking obstacles located on different elevations", () => {
    const cache = new (class extends WorldChunkCache {
      override tileAt() { return { ground: GroundKind.Grass, elevation: 1, stairs: false }; }
      override propsNear() {
        return [{ id: "low-boulder", kind: PropKind.Boulder, x: 20, y: 20, variant: 0, elevation: 0, radius: 0.45, blocksMovement: true }];
      }
      override poisNear() { return []; }
    })(1337);
    const moved = resolveMovement({ cache, x: 19.4, y: 20, dx: 0.5, dy: 0, radius: 0.25, elevation: 1 });
    expect(moved.x).toBeCloseTo(19.9, 4);
  });
});
