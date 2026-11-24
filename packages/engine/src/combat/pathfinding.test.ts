import { describe, expect, it } from "vitest";
import { WorldChunkCache } from "../world/collision.js";
import { findChunkPoi } from "../world/poiStamper.js";
import { POI_CHEST_OBSTACLE_SHAPE, closestObstacleCorePoint, propFootprintCenter } from "../world/propFootprints.js";
import { GroundKind, PropKind } from "../world/types.js";
import { findTilePath } from "./pathfinding.js";

class RiverBarrierCache extends WorldChunkCache {
  override tileAt(wx: number, wy: number) {
    if (Math.floor(wx) === 10) return { ground: GroundKind.DeepWater, elevation: 0, stairs: false };
    return super.tileAt(wx, wy);
  }
}

class ShallowFordRiverCache extends WorldChunkCache {
  override tileAt(wx: number, wy: number) {
    if (Math.floor(wx) === 10) {
      const ground = Math.floor(wy) === 2 ? GroundKind.ShallowWater : GroundKind.DeepWater;
      return { ground, elevation: 0, stairs: false };
    }
    return super.tileAt(wx, wy);
  }
  override propsNear() { return []; }
}

class SheerTwoTileCliffCache extends WorldChunkCache {
  override tileAt(_wx: number, wy: number) {
    const elev = Math.floor(wy) <= -8 ? 2 : 0;
    return { ground: GroundKind.Grass, elevation: elev, stairs: false };
  }
  override propsNear() { return []; }
}

class OneTileLedgeCache extends WorldChunkCache {
  override tileAt(_wx: number, wy: number) {
    const elev = Math.floor(wy) <= -8 ? 1 : 0;
    return { ground: GroundKind.Grass, elevation: elev, stairs: false };
  }
  override propsNear() { return []; }
}

describe("pathfinding", () => {
  it("routes around blocking props without clipping their trunk radius", () => {
    const cache = new WorldChunkCache(1337);
    const prop = cache.propsNear(45, 16).find((p) => p.blocksMovement);
    expect(prop).toBeDefined();
    if (!prop) return;
    const res = findTilePath({
      cache, startX: prop.x - 2.5, startY: prop.y, goalX: prop.x + 2.5, goalY: prop.y,
    });
    expect(res.reachedGoal).toBe(true);
    expect(res.waypoints.length).toBeGreaterThan(1);
    const center = propFootprintCenter(prop);
    for (const wp of res.waypoints) {
      expect(Math.hypot(wp.x - center.x, wp.y - center.y)).toBeGreaterThanOrEqual(prop.radius * 0.9);
    }
  });

  it("navigates stairs, jumps 1-tile ledges, and blocks sheer 2-tile cliffs", () => {
    const cache = new WorldChunkCache(1337);
    const res = findTilePath({
      cache, startX: -7.5, startY: -5.5, goalX: -7.5, goalY: -8.5, maxRadiusTiles: 8,
    });
    expect(res.reachedGoal).toBe(true);
    expect(res.waypoints.some((wp) => wp.x < -8.0)).toBe(true);
    expect(cache.tileAt(-7.5, -8.5).elevation).toBe(1);

    const ledge = findTilePath({
      cache: new OneTileLedgeCache(1337), startX: -7.5, startY: -5.5, goalX: -7.5, goalY: -9.5, maxRadiusTiles: 6,
    });
    expect(ledge.reachedGoal).toBe(true);

    const sheer = findTilePath({
      cache: new SheerTwoTileCliffCache(1337), startX: -7.5, startY: -5.5, goalX: -7.5, goalY: -9.5, maxRadiusTiles: 6,
    });
    expect(sheer.reachedGoal).toBe(false);
    expect(sheer.closestPoint.y).toBeGreaterThan(-8);
  });

  it("swims across deep water when necessary while preferring shallow fords", () => {
    const cache = new RiverBarrierCache(1337);
    const res = findTilePath({
      cache, startX: 6.5, startY: 0.5, goalX: 13.5, goalY: 0.5, maxRadiusTiles: 10,
    });
    expect(res.reachedGoal).toBe(true);
    expect(res.waypoints.some((wp) => Math.floor(wp.x) === 10)).toBe(true);

    const fordCache = new ShallowFordRiverCache(1337);
    const fordRes = findTilePath({
      cache: fordCache, startX: 8.5, startY: 0.5, goalX: 12.5, goalY: 0.5, maxRadiusTiles: 10,
    });
    expect(fordRes.reachedGoal).toBe(true);
    expect(fordRes.waypoints.some((wp) => Math.floor(wp.x) === 10 && Math.floor(wp.y) === 2)).toBe(true);
  });

  it("routes around POI chests and campfires without stepping through their colliders", () => {
    const cache = new WorldChunkCache(1337);
    const poi = findChunkPoi(1337, 1, 0);
    expect(poi).not.toBeNull();
    if (!poi) return;
    const fireCenter = propFootprintCenter({ kind: PropKind.Campfire, x: poi.centerX, y: poi.centerY + 0.8 });
    const res = findTilePath({
      cache, startX: poi.centerX, startY: poi.centerY + 2.2, goalX: poi.centerX, goalY: poi.chestY + 1.0, maxRadiusTiles: 12,
    });
    expect(res.reachedGoal).toBe(true);
    const chestObs = {
      id: `${poi.id}:chest`, x: poi.chestX, y: poi.chestY + POI_CHEST_OBSTACLE_SHAPE.offsetY,
      radius: POI_CHEST_OBSTACLE_SHAPE.radius, halfX: POI_CHEST_OBSTACLE_SHAPE.halfX,
      halfY: POI_CHEST_OBSTACLE_SHAPE.halfY, elevation: poi.elevation,
    };
    for (const wp of res.waypoints) {
      expect(Math.hypot(wp.x - fireCenter.x, wp.y - fireCenter.y)).toBeGreaterThanOrEqual(0.5);
      const chestCore = closestObstacleCorePoint(chestObs, { x: wp.x, y: wp.y });
      expect(Math.hypot(wp.x - chestCore.x, wp.y - chestCore.y)).toBeGreaterThanOrEqual(chestObs.radius);
    }
  });
});
