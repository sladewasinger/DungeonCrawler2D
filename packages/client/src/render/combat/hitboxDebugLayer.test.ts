import { describe, expect, it } from "vitest";
import { WorldChunkCache, type PlayerSnapshot, type ProjectileSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Graphics, Polygon } from "pixi.js";
import { HitboxDebugLayer } from "./hitboxDebugLayer.js";

function makePlayer(opts: { readonly id: string; readonly x: number; readonly y: number; readonly elevation: number }): PlayerSnapshot {
  return {
    id: opts.id,
    name: opts.id,
    x: opts.x,
    y: opts.y,
    elevation: opts.elevation,
    facingX: 1,
    facingY: 0,
    moving: true,
    torchLit: false,
    inWater: false,
    lastAckSeq: 1,
    heldItem: "sword",
    swingProgress: 0.45,
    comboStep: 1,
  };
}

function makeEntity(): WorldEntitySnapshot {
  return {
    id: "mob-1",
    kind: "boar",
    substance: "blood",
    x: -11.5,
    y: -6.2,
    elevation: 0,
    facingX: 0,
    facingY: -1,
    hp: 40,
    maxHp: 40,
    hitTimer: 0,
    staggerTimer: 0,
    bleedTimer: 0,
    telegraphProgress: 0,
    attackProgress: 0.5,
    aiState: "chase",
  };
}

function makeProjectile(): ProjectileSnapshot {
  return {
    id: "proj-1",
    ownerId: "p1",
    kind: "arrow",
    x: -10.0,
    y: -5.2,
    z: 0.45,
    vx: 14,
    vy: 0,
    elevation: 0,
    charge: 1,
    element: "none",
  };
}

function collectInstructionPolys(ins: Graphics["context"]["instructions"][number]): Polygon[] {
  if (ins.action !== "stroke" && ins.action !== "fill") return [];
  return ins.data.path.shapePath.shapePrimitives
    .map((prim) => prim.shape)
    .filter((shape): shape is Polygon => shape instanceof Polygon);
}

function assertPolygonAwayFromOrigin(poly: Polygon): void {
  for (let i = 0; i < poly.points.length; i += 2) {
    const px = poly.points[i]!;
    const py = poly.points[i + 1]!;
    expect(Number.isFinite(px)).toBe(true);
    expect(Number.isFinite(py)).toBe(true);
    expect(Math.hypot(px, py)).toBeGreaterThan(32);
  }
}

describe("HitboxDebugLayer", () => {
  it("resets subpaths cleanly so debug capsules and cones never anchor at origin (0, 0)", () => {
    const layer = new HitboxDebugLayer();
    layer.setEnabled(true);
    const local = makePlayer({ id: "p1", x: -10.5, y: -5.2, elevation: 0 });
    const elevated = makePlayer({ id: "p2", x: -8.5, y: -8.5, elevation: 1 });
    layer.render({
      cache: new WorldChunkCache(1337),
      local,
      players: [local, elevated],
      entities: [makeEntity()],
      projectiles: [makeProjectile()],
    });

    const graphics = layer.container.children[0] as Graphics;
    const polys = graphics.context.instructions.flatMap(collectInstructionPolys);
    expect(polys.length).toBeGreaterThanOrEqual(4);
    for (const poly of polys) assertPolygonAwayFromOrigin(poly);
  });
});
