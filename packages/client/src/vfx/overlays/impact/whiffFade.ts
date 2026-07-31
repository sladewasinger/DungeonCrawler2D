// Whiff arc-fade: a faint gray stroke traced along the melee wedge's own outer arc when
// a swing connects with nothing (panel round 3b item 5, WHIFF FEEDBACK) — "so misses
// read as misses". Distinct from the connect wedge (meleeWedge.ts) on every axis: cool
// gray instead of warm orange, stroke-only (no fill), and its own fainter/slower fade
// curve (whiffFadeMotion.ts) — a player should never confuse the two at a glance.
// One pooled Graphics per attacker id, same reuse pattern as MeleeWedgePool.
import Phaser from "phaser";
import { worldToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import { getViewOrientation, worldAngleToView } from "../../../render/view/index.js";
import { wedgeGeometry, type WedgeGeometry } from "../../combat/melee/meleeWedgeGeometry.js";
import { whiffAlpha } from "./whiffFadeMotion.js";
import { combatOriginY } from "../../../render/entities/motion/weaponOrbit.js";
import type { MeleeVfxInput } from "../../system/vfxSystemTypes.js";
import { depthForCombatGeometry } from "../../../render/entities/presentation/depthSort.js";

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
  spawn(input: MeleeVfxInput): void {
    const { id, x: worldX, y: worldY, z, angleRad, depth, tilePx, nowMs } = input;
    const arc = this.arcs.get(id) ?? { gfx: this.scene.add.graphics(), startedAtMs: -Infinity };
    this.arcs.set(id, arc);
    const screen = worldToScreen(worldX, worldY);
    const originY = combatOriginY(screen.y - z * tilePx, tilePx);
    drawArc({ gfx: arc.gfx, tipX: screen.x, tipY: originY, geo: wedgeGeometry(worldAngleToView(angleRad, getViewOrientation()), tilePx, input.profile) });
    arc.gfx.setDepth(depthForCombatGeometry(depth)).setVisible(true).setAlpha(whiffAlpha(0));
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
function drawArc({ gfx, tipX, tipY, geo }: { readonly gfx: Phaser.GameObjects.Graphics; readonly tipX: number; readonly tipY: number; readonly geo: WedgeGeometry }): void {
  gfx.clear();
  gfx.lineStyle(ARC_WIDTH_PX, ARC_COLOR, 1);
  if (geo.shape === "ground") {
    gfx.strokeCircle(tipX, tipY, geo.radiusPx);
    return;
  }
  gfx.beginPath();
  gfx.arc(tipX, tipY, geo.radiusPx, geo.startAngle, geo.endAngle, false);
  gfx.strokePath();
}
