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
import { SCREEN_TILE_PX } from "../boot/assetManifest.js";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { decalAlpha, isDecalExpired } from "./bloodDecalMotion.js";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";
import {
  GROUND_DECAL_VERTICAL_SCALE,
  groundedVisualPlacement,
} from "./groundPlaneDepth.js";

/** Keeps a busy fight readable without allowing the cosmetic pool to grow unbounded. */
export const DECAL_CAP = 96;
const BASE_ALPHA = 0.96;
const MIN_DIAMETER_PX = 10;
const MAX_DIAMETER_PX = 22;
const SCATTER_RADIUS_PX = 28;
interface Decal {
  readonly shape: Phaser.GameObjects.Ellipse;
  spawnMs: number;
}

export interface BloodDecalInput {
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
  readonly tint: number;
  readonly nowMs: number;
}

interface ScatterInput {
  readonly screen: { x: number; y: number };
  readonly offset: { x: number; y: number };
  readonly diameter: number;
}

interface DecalShapeInput {
  readonly shape: Phaser.GameObjects.Ellipse;
  readonly screenX: number;
  readonly diameter: number;
  readonly tint: number;
  readonly placement: ReturnType<typeof groundedVisualPlacement>;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function containedScatter({ screen, offset, diameter }: ScatterInput): { readonly x: number; readonly y: number } {
  const { x: screenX, y: screenY } = screen;
  const { x: scatterX, y: scatterY } = offset;
  const tileLeft = Math.floor(screenX / SCREEN_TILE_PX) * SCREEN_TILE_PX;
  const tileTop = Math.floor(screenY / SCREEN_TILE_PX) * SCREEN_TILE_PX;
  const halfWidth = diameter / 2;
  const halfHeight = diameter * GROUND_DECAL_VERTICAL_SCALE / 2;
  return {
    x: clamp(scatterX, tileLeft + halfWidth - screenX, tileLeft + SCREEN_TILE_PX - halfWidth - screenX),
    y: clamp(scatterY, tileTop + halfHeight - screenY, tileTop + SCREEN_TILE_PX - halfHeight - screenY),
  };
}

function configureDecalShape({ shape, screenX, diameter, tint, placement }: DecalShapeInput): void {
  shape
    .setPosition(screenX, placement.projectedScreenY)
    .setSize(diameter, diameter * GROUND_DECAL_VERTICAL_SCALE)
    .setFillStyle(tint, 0.96)
    .setStrokeStyle(0, tint, 0)
    .setAlpha(BASE_ALPHA)
    .setVisible(true)
    .setDepth(placement.depth);
}

export class BloodDecalPool {
  private readonly decals: Decal[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places one decal near (worldX, worldY), growing the pool until DECAL_CAP then
   * recycling the oldest-cycled slot round-robin. `groundHeight` is the hit position's
   * `groundAt` — GROUND-anchored (ELEVATION-PROJECTION section 5), shifted by it. */
  spawn(input: BloodDecalInput): void {
    const decal = shouldGrowPool(this.decals.length, DECAL_CAP) ? this.grow() : this.recycle();
    this.place({ decal, input });
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

  private place({ decal, input }: { readonly decal: Decal; readonly input: BloodDecalInput }): void {
    const { x, y, groundHeight, tint, nowMs } = input;
    const screen = worldToScreen(x, y);
    const scatterAngle = Math.random() * Math.PI * 2;
    const scatterDistance = Math.sqrt(Math.random()) * SCATTER_RADIUS_PX;
    const diameter = MIN_DIAMETER_PX +
      Math.random() * (MAX_DIAMETER_PX - MIN_DIAMETER_PX);
    const scatter = containedScatter({
      screen,
      offset: { x: Math.cos(scatterAngle) * scatterDistance, y: Math.sin(scatterAngle) * scatterDistance },
      diameter,
    });
    const placement = groundedVisualPlacement({
      rawScreenY: screen.y,
      groundHeight,
      layer: "blood",
      scatterScreenY: scatter.y,
    });
    configureDecalShape({ shape: decal.shape, screenX: screen.x + scatter.x, diameter, tint, placement });
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
