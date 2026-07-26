// Pooled floor blood decals: cosmetic-only, hard-capped, 30s fade (bloodDecalMotion.ts)
// with round-robin reuse once at cap (bloodDecalSlots.ts) — so a long fight can't grow
// the pool unbounded (ASSUMPTIONS.md #29). A filled Ellipse Shape, not a sprite: the
// atlas's only soft-glow frame (`light_soft`, used elsewhere for ADD-blend light halos —
// particleRecipes.ts) is a sparse, low-density gradient that reads as near-invisible
// under MULTIPLY blend (verified live — a plain Shape rendered, that Image didn't), so a
// solid-fill Shape is the reliable choice here, matching the codebase's existing
// Ellipse/Arc Shape precedent (shadow.ts, meleeWedge.ts). Multiply-blended, never
// additive: decals darken the floor, they don't glow — VISUAL_DIRECTION's rule.
//
// GROUND-anchored (docs/ELEVATION-PROJECTION.md section 5): shifted by the hit
// position's `groundAt` height, same `height*TILE` shape the shadow/halo use.
import Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { decalAlpha, isDecalExpired } from "./bloodDecalMotion.js";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";
import { groundedVisualPlacement } from "./groundPlaneDepth.js";

/** Keeps a busy fight readable without allowing the cosmetic pool to grow unbounded. */
export const DECAL_CAP = 96;
const BASE_ALPHA = 0.88;
const MIN_DIAMETER_PX = 10;
const MAX_DIAMETER_PX = 22;
const SCATTER_RADIUS_PX = 28;
interface Decal {
  readonly shape: Phaser.GameObjects.Ellipse;
  spawnMs: number;
}

export class BloodDecalPool {
  private readonly decals: Decal[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places one decal near (worldX, worldY), growing the pool until DECAL_CAP then
   * recycling the oldest-cycled slot round-robin. `groundHeight` is the hit position's
   * `groundAt` — GROUND-anchored (ELEVATION-PROJECTION section 5), shifted by it. */
  spawn(worldX: number, worldY: number, groundHeight: number, tint: number, nowMs: number): void {
    const decal = shouldGrowPool(this.decals.length, DECAL_CAP) ? this.grow() : this.recycle();
    this.place(decal, worldX, worldY, groundHeight, tint, nowMs);
  }

  private grow(): Decal {
    const decal: Decal = { shape: this.buildShape(), spawnMs: -Infinity };
    this.decals.push(decal);
    return decal;
  }

  private recycle(): Decal {
    const index = recycleSlotIndex(this.cursor, DECAL_CAP);
    this.cursor++;
    // Index is always in range: recycle() only runs once the pool has grown to DECAL_CAP.
    return this.decals[index]!;
  }

  private buildShape(): Phaser.GameObjects.Ellipse {
    return this.scene.add
      .ellipse(0, 0, 1, 1)
      .setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private place(decal: Decal, worldX: number, worldY: number, groundHeight: number, tint: number, nowMs: number): void {
    const screen = worldToScreen(worldX, worldY);
    const scatterAngle = Math.random() * Math.PI * 2;
    const scatterDistance = Math.sqrt(Math.random()) * SCATTER_RADIUS_PX;
    const scatterX = Math.cos(scatterAngle) * scatterDistance;
    const scatterY = Math.sin(scatterAngle) * scatterDistance;
    const diameter = MIN_DIAMETER_PX +
      Math.random() * (MAX_DIAMETER_PX - MIN_DIAMETER_PX);
    const placement = groundedVisualPlacement(
      screen.y,
      groundHeight,
      "blood",
      scatterY,
    );
    decal.shape
      .setPosition(screen.x + scatterX, placement.projectedScreenY)
      .setSize(diameter, diameter)
      .setFillStyle(tint, 0.92)
      .setStrokeStyle(0, tint, 0)
      .setAlpha(BASE_ALPHA)
      .setVisible(true)
      .setDepth(placement.depth);
    decal.spawnMs = nowMs;
  }

  /** Fades every live decal, hiding it once past its lifetime (the Shape is kept for reuse). */
  update(nowMs: number): void {
    for (const decal of this.decals) {
      const elapsed = nowMs - decal.spawnMs;
      const expired = isDecalExpired(elapsed);
      decal.shape
        .setAlpha(decalAlpha(elapsed, BASE_ALPHA))
        .setVisible(!expired);
    }
  }

  dispose(): void {
    for (const decal of this.decals) decal.shape.destroy();
    this.decals.length = 0;
    this.cursor = 0;
  }
}
