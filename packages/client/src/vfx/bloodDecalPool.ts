// Pooled floor blood decals: cosmetic-only, hard-capped, ~10s fade (bloodDecalMotion.ts)
// with round-robin reuse once at cap (bloodDecalSlots.ts) — so a long fight can't grow
// the pool unbounded (ASSUMPTIONS.md #29). A filled Ellipse Shape, not a sprite: the
// atlas's only soft-glow frame (`light_soft`, used elsewhere for ADD-blend light halos —
// particleRecipes.ts) is a sparse, low-density gradient that reads as near-invisible
// under MULTIPLY blend (verified live — a plain Shape rendered, that Image didn't), so a
// solid-fill Shape is the reliable choice here, matching the codebase's existing
// Ellipse/Arc Shape precedent (shadow.ts, meleeWedge.ts). Multiply-blended, never
// additive: decals darken the floor, they don't glow — VISUAL_DIRECTION's rule.
import Phaser from "phaser";
import { depthForEntity } from "../render/entities/depthSort.js";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { decalAlpha, isDecalExpired } from "./bloodDecalMotion.js";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";

/** Raised with the 45s decal lifetime so long fights don't recycle fresh blood. */
export const DECAL_CAP = 96;
const BASE_ALPHA = 0.85;
const MIN_RADIUS_PX = 7;
const MAX_RADIUS_PX = 14;
/** Just under a same-row entity's feet depth, mirroring itemVisual's shadow bias. */
const DEPTH_BIAS = -0.25;

interface Decal {
  readonly shape: Phaser.GameObjects.Ellipse;
  spawnMs: number;
}

export class BloodDecalPool {
  private readonly decals: Decal[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places one decal near (worldX, worldY), growing the pool until DECAL_CAP then
   * recycling the oldest-cycled slot round-robin. */
  spawn(worldX: number, worldY: number, tint: number, nowMs: number): void {
    const decal = shouldGrowPool(this.decals.length, DECAL_CAP) ? this.grow() : this.recycle();
    this.place(decal, worldX, worldY, tint, nowMs);
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
    return this.scene.add.ellipse(0, 0, 1, 1).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private place(decal: Decal, worldX: number, worldY: number, tint: number, nowMs: number): void {
    const screen = worldToScreen(worldX, worldY);
    const scatterPx = 12;
    const scatterX = (Math.random() - 0.5) * scatterPx;
    const scatterY = (Math.random() - 0.5) * scatterPx;
    const radius = MIN_RADIUS_PX + Math.random() * (MAX_RADIUS_PX - MIN_RADIUS_PX);
    decal.shape
      .setPosition(screen.x + scatterX, screen.y + scatterY)
      .setSize(radius * 2, radius * 1.4)
      .setFillStyle(tint, 1)
      .setAlpha(BASE_ALPHA)
      .setVisible(true)
      .setDepth(depthForEntity(worldY) + DEPTH_BIAS);
    decal.spawnMs = nowMs;
  }

  /** Fades every live decal, hiding it once past its lifetime (the Shape is kept for reuse). */
  update(nowMs: number): void {
    for (const decal of this.decals) {
      const elapsed = nowMs - decal.spawnMs;
      const expired = isDecalExpired(elapsed);
      decal.shape.setAlpha(decalAlpha(elapsed, BASE_ALPHA)).setVisible(!expired);
    }
  }

  dispose(): void {
    for (const decal of this.decals) decal.shape.destroy();
    this.decals.length = 0;
    this.cursor = 0;
  }
}
