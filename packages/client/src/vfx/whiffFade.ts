// Whiff arc-fade: a faint gray stroke traced along the melee wedge's own outer arc when
// a swing connects with nothing (panel round 3b item 5, WHIFF FEEDBACK) — "so misses
// read as misses". Distinct from the connect wedge (meleeWedge.ts) on every axis: cool
// gray instead of warm orange, stroke-only (no fill), and its own fainter/slower fade
// curve (whiffFadeMotion.ts) — a player should never confuse the two at a glance.
// One pooled Graphics per attacker id, same reuse pattern as MeleeWedgePool.
import Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { getViewOrientation, worldAngleToView } from "../render/view/index.js";
import { wedgeGeometry, type WedgeGeometry } from "./meleeWedgeGeometry.js";
import { whiffAlpha } from "./whiffFadeMotion.js";

const ARC_COLOR = 0x9aa0a6;
const ARC_WIDTH_PX = 3;

interface WhiffArc {
  readonly gfx: Phaser.GameObjects.Graphics;
  startedAtMs: number;
}

export class WhiffFadePool {
  private readonly arcs = new Map<string, WhiffArc>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** (Re)draws `id`'s whiff arc at world (x,y,z) aimed at `angleRad` — same geometry
   * inputs as MeleeWedgePool.spawn, so the miss cue traces exactly the swing that missed. */
  spawn(id: string, worldX: number, worldY: number, z: number, angleRad: number, depth: number, tilePx: number, nowMs: number): void {
    const arc = this.arcs.get(id) ?? { gfx: this.scene.add.graphics(), startedAtMs: -Infinity };
    this.arcs.set(id, arc);
    const screen = worldToScreen(worldX, worldY);
    drawArc(arc.gfx, screen.x, screen.y - z * tilePx, wedgeGeometry(worldAngleToView(angleRad, getViewOrientation()), tilePx));
    arc.gfx.setDepth(depth).setVisible(true).setAlpha(whiffAlpha(0));
    arc.startedAtMs = nowMs;
  }

  update(nowMs: number): void {
    for (const arc of this.arcs.values()) {
      const alpha = whiffAlpha(nowMs - arc.startedAtMs);
      arc.gfx.setAlpha(alpha).setVisible(alpha > 0);
    }
  }

  dispose(): void {
    for (const arc of this.arcs.values()) arc.gfx.destroy();
    this.arcs.clear();
  }
}

/** Strokes just the outer arc edge (no fill, no radius lines) — a silhouette distinct
 * from the connect wedge's filled pie + rim. */
function drawArc(gfx: Phaser.GameObjects.Graphics, tipX: number, tipY: number, geo: WedgeGeometry): void {
  gfx.clear();
  gfx.lineStyle(ARC_WIDTH_PX, ARC_COLOR, 1);
  gfx.beginPath();
  gfx.arc(tipX, tipY, geo.radiusPx, geo.startAngle, geo.endAngle, false);
  gfx.strokePath();
}
