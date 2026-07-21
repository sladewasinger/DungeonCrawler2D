// Melee-swing wedge telegraph: one pooled Graphics per attacking entity id, redrawn only
// when that id's swing starts (not every frame) and faded via alpha thereafter — the
// v1-style "pie shape wedge" showing the attack's real distance/arc, per VISUAL_DIRECTION's
// "hits feel like hits" juice requirement.
//
// Drawn with Graphics.slice(), the one Phaser primitive whose fill path runs
// center -> arc -> back to center: a true ice-cream-cone pie with its tip AT the
// wielder. The previous Phaser.GameObjects.Arc Shape closes its fill chord-to-chord
// instead, which rendered the region between the curve and the chord — a crescent
// floating a full radius away from the player with no tip ("a floating slice too far
// away from me", user screenshots 2026-07-20). Note for whoever next touches this: in
// this repo's headless Playwright screenshot harness specifically, any overlay draw
// call here — proven with both a raw Graphics arc and an Arc Shape — stops compositing
// once the gallery's terrain/lighting/entity-showcase layers are also active; that
// reproduces in the harness only; treat it as a screenshot-tooling ceiling, not a
// rendering bug here.
import Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { getViewOrientation, worldAngleToView } from "../render/view/index.js";
import { wedgeAlpha, wedgeGeometry, type WedgeGeometry } from "./meleeWedgeGeometry.js";

/** Warm white-orange fill, per docs/VISUAL_DIRECTION.md's fire/torch accent. */
const FILL_COLOR = 0xffb37a;
/** 0.25 was invisible on the dark canvas — only the rim read, which made the
 * telegraph look like it started outside the player (user playtest 2026-07-20).
 * The filled pie from the wielder's feet is the actual hit area, point-blank included. */
const FILL_ALPHA = 0.45;
const RIM_COLOR = 0xffe9c9;
const RIM_ALPHA = 0.9;
const RIM_WIDTH_PX = 2;

interface WedgeSwing {
  readonly gfx: Phaser.GameObjects.Graphics;
  startedAtMs: number;
}

export class MeleeWedgePool {
  private readonly swings = new Map<string, WedgeSwing>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** (Re)shapes `id`'s wedge at world (x,y,z) aimed at `angleRad`, starting its fade now. Reuses the id's Graphics object across swings instead of allocating a new one each time. */
  spawn(id: string, worldX: number, worldY: number, z: number, angleRad: number, depth: number, tilePx: number, nowMs: number): void {
    const swing = this.swings.get(id) ?? { gfx: this.scene.add.graphics(), startedAtMs: -Infinity };
    this.swings.set(id, swing);
    // ELEVATION-PROJECTION section 5: ENTITY-anchored at the wielder's LIFTED feet
    // (`- z*TILE`), same absolute-z axis the wielder's own sprite lifts by — the
    // telegraph tracks the body, not the ground, when the wielder is airborne.
    const screen = worldToScreen(worldX, worldY);
    drawWedge(swing.gfx, screen.x, screen.y - z * tilePx, wedgeGeometry(worldAngleToView(angleRad, getViewOrientation()), tilePx));
    swing.gfx.setDepth(depth).setVisible(true).setAlpha(1);
    swing.startedAtMs = nowMs;
  }

  /**
   * Fades every active wedge; hides it once fully faded (the Graphics object itself is
   * kept for reuse). Visibility always tracks `alpha > 0` both ways, not just hiding on
   * fade-out: `spawn`'s trigger-time clock (a raw event handler, e.g. `performance.now()`)
   * and this `update`'s per-frame scene clock can race by a frame, so the very first
   * update after a spawn can read a still-negative (pre-spawn) elapsed and alpha 0 — a
   * one-way hide would then leave it permanently invisible once alpha recovers.
   */
  update(nowMs: number): void {
    for (const swing of this.swings.values()) {
      const alpha = wedgeAlpha(nowMs - swing.startedAtMs);
      swing.gfx.setAlpha(alpha).setVisible(alpha > 0);
    }
  }

  dispose(): void {
    for (const swing of this.swings.values()) swing.gfx.destroy();
    this.swings.clear();
  }
}

/** The pie: tip at (tipX, tipY), fanning out to the geometry's arc — fill plus rim stroke. */
function drawWedge(gfx: Phaser.GameObjects.Graphics, tipX: number, tipY: number, geo: WedgeGeometry): void {
  gfx.clear();
  gfx.fillStyle(FILL_COLOR, FILL_ALPHA);
  gfx.slice(tipX, tipY, geo.radiusPx, geo.startAngle, geo.endAngle, false);
  gfx.fillPath();
  gfx.lineStyle(RIM_WIDTH_PX, RIM_COLOR, RIM_ALPHA);
  gfx.slice(tipX, tipY, geo.radiusPx, geo.startAngle, geo.endAngle, false);
  gfx.strokePath();
}
