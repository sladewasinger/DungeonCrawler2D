import { updateGuardCone, type GuardConeDepth } from "../combat/attack/guardCone.js";
import {
  attackReadyFlashForVisual,
  cooldownForVisual,
} from "../combat/attack/attackCooldown.js";
import { updateAttackCooldownIndicator } from "../combat/attack/attackCooldownIndicator.js";
import { spriteLiftPx } from "../motion/lift.js";
import { combatOverlayPosition, worldToScreen } from "../geometry/worldToScreen.js";
import { depthForCombatGeometry, depthForCombatOverlay } from "../presentation/depthSort.js";
import type { PlayerVisual } from "../visuals/state.js";
import type { PlayerEntityView } from "../visuals/view.js";

export interface CombatWorldAnchor {
  readonly screenX: number;
  readonly feetY: number;
}

export interface PlayerGuardOverlayInput {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly blocking: boolean;
  readonly facingAngle: number;
  readonly combatPosition: ReturnType<typeof combatOverlayPosition>;
  readonly worldAnchor: CombatWorldAnchor;
  readonly nowMs: number;
}

export function combatWorldAnchor(view: PlayerEntityView): CombatWorldAnchor {
  const screen = worldToScreen(view.x, view.y);
  return { screenX: screen.x, feetY: screen.y - spriteLiftPx(view.z) };
}

/** Keeps combat geometry on the world-projected feet position, not the art offset. */
export function updatePlayerGuardOverlay({
  visual,
  view,
  blocking,
  facingAngle,
  combatPosition,
  worldAnchor,
  nowMs,
}: PlayerGuardOverlayInput): GuardConeDepth {
  const depth = { wielderDepth: visual.body.depth, ...combatPosition };
  updateGuardCone({
    visual,
    blocking,
    facingAngle,
    depth,
    nowMs,
    originX: worldAnchor.screenX,
    originY: worldAnchor.feetY,
    ...(view.blockFeedback === undefined ? {} : { blockFeedback: view.blockFeedback }),
  });
  return depth;
}

export interface PlayerAttackRecoveryInput {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly nowMs: number;
  readonly blocking: boolean;
  readonly combatDepth: GuardConeDepth;
  readonly worldAnchor: CombatWorldAnchor;
}

export function updatePlayerAttackRecovery(input: PlayerAttackRecoveryInput): boolean {
  const { visual, view, nowMs, blocking, combatDepth, worldAnchor } = input;
  const cooldown = cooldownForVisual(visual, nowMs);
  const readyFlash = attackReadyFlashForVisual({
    visual,
    state: cooldown,
    nowMs,
    downed: view.downed,
  });
  updateAttackCooldownIndicator({
    graphics: visual.attackCooldownIndicator,
    state: cooldown,
    x: worldAnchor.screenX,
    feetY: worldAnchor.feetY,
    depth: depthForCombatGeometry(depthForCombatOverlay(combatDepth)),
    blocking,
    downed: view.downed,
  });
  return readyFlash;
}
