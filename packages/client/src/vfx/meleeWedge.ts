// Melee-swing wedge telegraph: one pooled Arc Shape per attacking entity id, redrawn only
// when that id's swing starts (not every frame) and faded via alpha thereafter — the
// v1-style "pie shape wedge" showing the attack's real distance/arc, per VISUAL_DIRECTION's
// "hits feel like hits" juice requirement.
//
// Uses Phaser.GameObjects.Arc (a batched Shape primitive, same family as the hp bar's
// Rectangle/the shadow's Ellipse and this codebase's only fill-shape precedent) rather
// than a raw Graphics object: it needs no manual moveTo/arc/closePath path composition,
// supports independent fill+stroke alpha out of the box, and is the more portable choice
// generally (Graphics' arbitrary-path fill goes through a separate stencil-buffer-based
// WebGL pipeline some lower-end/software GL drivers handle poorly). Note for whoever next
// touches this: in this repo's headless Playwright screenshot harness specifically, *any*
// overlay draw call here — proven with both a raw Graphics arc and this Arc Shape — stops
// compositing once the gallery's terrain/lighting/entity-showcase layers are also active,
// while the exact same code renders correctly with those layers removed; that reproduces
// in the harness only; treat it as a screenshot-tooling ceiling, not a rendering bug here.
import Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { wedgeAlpha, wedgeGeometry, type WedgeGeometry } from "./meleeWedgeGeometry.js";

/** Warm white-orange fill, per docs/VISUAL_DIRECTION.md's fire/torch accent. */
const FILL_COLOR = 0xffb37a;
const FILL_ALPHA = 0.25;
const RIM_COLOR = 0xffe9c9;
const RIM_ALPHA = 0.9;
const RIM_WIDTH_PX = 2;
const RAD_TO_DEG = 180 / Math.PI;

interface WedgeSwing {
  readonly shape: Phaser.GameObjects.Arc;
  startedAtMs: number;
}

export class MeleeWedgePool {
  private readonly swings = new Map<string, WedgeSwing>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** (Re)shapes `id`'s wedge at world (x,y) aimed at `angleRad`, starting its fade now. Reuses the id's Arc object across swings instead of allocating a new one each time. */
  spawn(id: string, worldX: number, worldY: number, angleRad: number, depth: number, tilePx: number, nowMs: number): void {
    const swing = this.swings.get(id) ?? this.build();
    this.swings.set(id, swing);
    const screen = worldToScreen(worldX, worldY);
    applyWedgeShape(swing.shape, screen.x, screen.y, wedgeGeometry(angleRad, tilePx));
    swing.shape.setDepth(depth).setVisible(true).setAlpha(1);
    swing.startedAtMs = nowMs;
  }

  private build(): WedgeSwing {
    const shape = this.scene.add.arc(0, 0, 1, 0, 1, false);
    shape.setFillStyle(FILL_COLOR, FILL_ALPHA);
    shape.setStrokeStyle(RIM_WIDTH_PX, RIM_COLOR, RIM_ALPHA);
    return { shape, startedAtMs: -Infinity };
  }

  /**
   * Fades every active wedge; hides it once fully faded (the Arc object itself is kept
   * for reuse). Visibility always tracks `alpha > 0` both ways, not just hiding on fade-
   * out: `spawn`'s trigger-time clock (a raw event handler, e.g. `performance.now()`) and
   * this `update`'s per-frame scene clock can race by a frame, so the very first update
   * after a spawn can read a still-negative (pre-spawn) elapsed and alpha 0 — a one-way
   * hide would then leave it permanently invisible once alpha recovers.
   */
  update(nowMs: number): void {
    for (const swing of this.swings.values()) {
      const alpha = wedgeAlpha(nowMs - swing.startedAtMs);
      swing.shape.setAlpha(alpha).setVisible(alpha > 0);
    }
  }

  dispose(): void {
    for (const swing of this.swings.values()) swing.shape.destroy();
    this.swings.clear();
  }
}

/** Arc's start/end angles are in degrees; wedgeGeometry's are radians (matching resolveAimAngle/atan2 throughout the rest of the client). */
function applyWedgeShape(shape: Phaser.GameObjects.Arc, centerX: number, centerY: number, geo: WedgeGeometry): void {
  shape.setPosition(centerX, centerY);
  shape.radius = geo.radiusPx;
  shape.startAngle = geo.startAngle * RAD_TO_DEG;
  shape.endAngle = geo.endAngle * RAD_TO_DEG;
}
