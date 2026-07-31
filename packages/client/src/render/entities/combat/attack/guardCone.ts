import type Phaser from "phaser";
import type { PlayerVisual } from "../../visuals/state.js";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import { depthForCombatGeometry, depthForCombatOverlay } from "../../presentation/depthSort.js";
import { combatOriginY } from "../../motion/weaponOrbit.js";
import type { CombatOverlayPosition } from "../../geometry/worldToScreen.js";
import type { BlockFeedbackState } from "../../../../combat/blockFeedback.js";
import { blockFeedbackAlpha } from "../../../../combat/blockFeedback.js";
import { guardWedgeGeometry } from "./guardGeometry.js";

export interface GuardConeDepth extends CombatOverlayPosition {
  readonly wielderDepth: number;
}

const GUARD_FILL_COLOR = 0x28658d;
const GUARD_FILL_ALPHA = 0.34;
const GUARD_RIM_COLOR = 0xb7e8ff;
const GUARD_RIM_ALPHA = 0.9;
const GUARD_RIM_WIDTH_PX = 2;

export interface GuardConeUpdate {
  readonly visual: PlayerVisual;
  readonly blocking: boolean;
  readonly facingAngle: number;
  readonly depth: GuardConeDepth;
  readonly blockFeedback?: BlockFeedbackState;
  readonly nowMs: number;
  /** World-projected feet position, intentionally independent from sprite art offset. */
  readonly originX: number;
  readonly originY: number;
}

export const updateGuardCone = ({
  visual,
  blocking,
  facingAngle,
  depth,
  blockFeedback,
  nowMs,
  originX,
  originY,
}: GuardConeUpdate): void => {
  const cone = visual.guardCone;
  if (!cone) return;
  if (blocking) {
    drawGuard({ cone, originX, originY, facingAngle, feedback: blockFeedback, nowMs });
  } else {
    cone.clear().setVisible(false);
    return;
  }
  cone.setDepth(depthForCombatGeometry(depthForCombatOverlay(depth))).setVisible(true);
};

interface GuardDrawRequest {
  readonly cone: Phaser.GameObjects.Graphics;
  readonly originX: number;
  readonly originY: number;
  readonly facingAngle: number;
  readonly feedback: BlockFeedbackState | undefined;
  readonly nowMs: number;
}

function drawGuard({ cone, originX, originY, facingAngle, feedback, nowMs }: GuardDrawRequest): void {
  const geometry = guardWedgeGeometry(facingAngle, SCREEN_TILE_PX);
  drawGuardCone({
    cone,
    originX,
    originY: combatOriginY(originY, SCREEN_TILE_PX),
    geometry,
    feedbackAlpha: feedback === undefined ? 0 : blockFeedbackAlpha(nowMs - feedback.startedAtMs),
  });
}

interface GuardConeDrawing {
  readonly cone: Phaser.GameObjects.Graphics;
  readonly originX: number;
  readonly originY: number;
  readonly geometry: ReturnType<typeof guardWedgeGeometry>;
  readonly feedbackAlpha: number;
}

function drawGuardCone({ cone, originX, originY, geometry, feedbackAlpha }: GuardConeDrawing): void {
  cone.clear();
  const flash = feedbackAlpha > 0;
  const fillColor = flash ? 0xffe07a : GUARD_FILL_COLOR;
  const fillAlpha = flash ? Math.max(GUARD_FILL_ALPHA, feedbackAlpha * 0.5) : GUARD_FILL_ALPHA;
  const rimColor = flash ? 0xffffcf : GUARD_RIM_COLOR;
  const rimAlpha = flash ? Math.max(GUARD_RIM_ALPHA, feedbackAlpha) : GUARD_RIM_ALPHA;
  const rimWidth = flash ? 3 : GUARD_RIM_WIDTH_PX;
  cone.fillStyle(fillColor, fillAlpha);
  cone.slice(originX, originY, geometry.radiusPx, geometry.startAngle, geometry.endAngle, false);
  cone.fillPath();
  cone.lineStyle(rimWidth, rimColor, rimAlpha);
  cone.slice(originX, originY, geometry.radiusPx, geometry.startAngle, geometry.endAngle, false);
  cone.strokePath();
  if (flash) drawGuardImpactRim({ cone, originX, originY, geometry, feedbackAlpha });
}

function drawGuardImpactRim(input: GuardConeDrawing): void {
  const { cone, originX, originY, geometry, feedbackAlpha } = input;
  const radius = geometry.radiusPx + feedbackAlpha * 5;
  cone.lineStyle(2, 0xffffdf, feedbackAlpha);
  cone.slice(originX, originY, radius, geometry.startAngle, geometry.endAngle, false);
  cone.strokePath();
}
