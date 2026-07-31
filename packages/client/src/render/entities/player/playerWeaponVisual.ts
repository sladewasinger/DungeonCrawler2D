import { updateGuardCone } from "../combat/attack/guardCone.js";
import {
  attackReadyFlashForVisual,
  cooldownForVisual,
  recordAttackStart,
} from "../combat/attack/attackCooldown.js";
import { updateAttackCooldownIndicator } from "../combat/attack/attackCooldownIndicator.js";
import { createHeldWeapon, updateHeldWeapon } from "../combat/weapon/heldWeapon.js";
import type { PlayerVisual } from "../visuals/state.js";
import type { PlayerEntityView, RenderContext } from "../visuals/view.js";
import { FIST_FALLBACK_FRAME, weaponIconFrame } from "../combat/weapon/weaponIcon.js";
import { combatOverlayPosition } from "../geometry/worldToScreen.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { worldAngleToView } from "../../view/transform/viewTransform.js";
import { weaponProfileForId } from "../../../scenes/dungeon/world/contentQueries.js";
import { depthForCombatGeometry, depthForCombatOverlay } from "../presentation/depthSort.js";

const STRIKE_DURATION_MS = 160;

export { createHeldWeapon };

export interface PlayerWeaponUpdate {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly context: RenderContext;
}

export function updatePlayerWeapon({ visual, view, context }: PlayerWeaponUpdate): void {
  const blocking = !view.downed && view.blocking;
  const attackActive = !view.downed && view.attacking;
  const striking = attackActive && !view.blocking;
  const profile = weaponProfileForId(view.weaponId);
  applySwingEdge({ visual, attacking: attackActive, nowMs: context.nowMs, cooldownMs: profile.cooldownMs });
  const facingAngle = worldAngleToView(Math.atan2(view.faceY, view.faceX), getViewOrientation());
  const combatPosition = combatOverlayPosition({ worldX: view.x, worldY: view.y });
  const guardConeInput = {
    visual,
    blocking,
    facingAngle: view.weaponAimAngle === null ? facingAngle : visual.weaponAngle,
    depth: { wielderDepth: visual.body.depth, ...combatPosition },
    nowMs: context.nowMs,
    ...(view.blockFeedback === undefined ? {} : { blockFeedback: view.blockFeedback }),
  };
  updateGuardCone(guardConeInput);
  const attackReadyFlash = updateAttackRecovery({
    visual,
    view,
    nowMs: context.nowMs,
    blocking,
    combatDepth: guardConeInput.depth,
  });
  updateHeldWeapon(visual.weapon, weaponFrame(view), weaponPose({
    visual,
    view,
    context,
    blocking,
    striking,
    facingAngle,
    combatPosition,
    attackReadyFlash,
  }));
}

interface AttackRecoveryUpdate {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly nowMs: number;
  readonly blocking: boolean;
  readonly combatDepth: {
    readonly wielderDepth: number;
    readonly wielderViewY: number;
  };
}

function updateAttackRecovery(input: AttackRecoveryUpdate): boolean {
  const { visual, view, nowMs, blocking, combatDepth } = input;
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
    x: visual.body.x,
    feetY: visual.body.y,
    depth: depthForCombatGeometry(depthForCombatOverlay(combatDepth)),
    blocking,
    downed: view.downed,
  });
  return readyFlash;
}

interface WeaponPoseInput extends PlayerWeaponUpdate {
  readonly blocking: boolean;
  readonly striking: boolean;
  readonly attackReadyFlash: boolean;
  readonly facingAngle: number;
  readonly combatPosition: ReturnType<typeof combatOverlayPosition>;
}

function weaponPose({
  visual,
  view,
  context,
  blocking,
  striking,
  facingAngle,
  combatPosition,
  attackReadyFlash,
}: WeaponPoseInput) {
  const rawFrame = view.downed ? null : weaponIconFrame(view.weaponId);
  const isFistFallback = rawFrame === null && !view.downed;
  return {
    screenX: visual.body.x,
    screenY: visual.body.y,
    facingX: view.faceX,
    striking,
    blocking,
    attackReadyFlash,
    nowMs: context.nowMs,
    strikeProgress: strikeProgress(visual, striking, context.nowMs),
    wielderDepth: visual.body.depth,
    ...combatPosition,
    orbitAngleRad: view.weaponAimAngle === null ? facingAngle : visual.weaponAngle,
    attackAngleRad: worldAngleToView(view.attackAngleRad, getViewOrientation()),
    isFistFallback,
  };
}

function weaponFrame(view: PlayerEntityView): string | null {
  const rawFrame = view.downed ? null : weaponIconFrame(view.weaponId);
  return rawFrame ?? (view.downed ? null : FIST_FALLBACK_FRAME);
}

function applySwingEdge(input: {
  readonly visual: PlayerVisual;
  readonly attacking: boolean;
  readonly nowMs: number;
  readonly cooldownMs: number;
}): void {
  const { visual, attacking, nowMs, cooldownMs } = input;
  if (attacking && !visual.wasAttacking) {
    visual.swingStartMs = nowMs;
    recordAttackStart(visual, nowMs, cooldownMs);
  }
  visual.wasAttacking = attacking;
}

function strikeProgress(visual: PlayerVisual, attacking: boolean, nowMs: number): number {
  if (!attacking || visual.swingStartMs === undefined) return 0;
  return Math.min(1, (nowMs - visual.swingStartMs) / STRIKE_DURATION_MS);
}
