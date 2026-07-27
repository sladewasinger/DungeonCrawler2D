import { updateGuardCone } from "../guardCone.js";
import { createHeldWeapon, updateHeldWeapon } from "../heldWeapon.js";
import type { PlayerVisual } from "../state.js";
import type { PlayerEntityView, RenderContext } from "../view.js";
import { FIST_FALLBACK_FRAME, weaponIconFrame } from "../weaponIcon.js";
import { combatOverlayPosition } from "../worldToScreen.js";
import { getViewOrientation } from "../../view/viewState.js";
import { worldAngleToView } from "../../view/viewTransform.js";

const STRIKE_DURATION_MS = 160;

export { createHeldWeapon };

export interface PlayerWeaponUpdate {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly context: RenderContext;
}

export function updatePlayerWeapon({ visual, view, context }: PlayerWeaponUpdate): void {
  const blocking = !view.downed && view.blocking;
  const striking = !view.downed && !view.blocking && view.attacking;
  applySwingEdge(visual, striking, context.nowMs);
  const facingAngle = worldAngleToView(Math.atan2(view.faceY, view.faceX), getViewOrientation());
  const combatPosition = combatOverlayPosition({ worldX: view.x, worldY: view.y, z: view.z, world: context.world });
  updateGuardCone({
    visual,
    blocking,
    facingAngle: view.weaponAimAngle === null ? facingAngle : visual.weaponAngle,
    depth: { wielderDepth: visual.body.depth, ...combatPosition },
  });
  updateHeldWeapon(visual.weapon, weaponFrame(view), weaponPose({ visual, view, context, blocking, striking, facingAngle, combatPosition }));
}

interface WeaponPoseInput extends PlayerWeaponUpdate {
  readonly blocking: boolean;
  readonly striking: boolean;
  readonly facingAngle: number;
  readonly combatPosition: ReturnType<typeof combatOverlayPosition>;
}

function weaponPose({ visual, view, context, blocking, striking, facingAngle, combatPosition }: WeaponPoseInput) {
  const rawFrame = view.downed ? null : weaponIconFrame(view.weaponId);
  const isFistFallback = rawFrame === null && !view.downed;
  return {
    screenX: visual.body.x,
    screenY: visual.body.y,
    facingX: view.faceX,
    striking,
    blocking,
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

function applySwingEdge(visual: PlayerVisual, attacking: boolean, nowMs: number): void {
  if (attacking && !visual.wasAttacking) visual.swingStartMs = nowMs;
  visual.wasAttacking = attacking;
}

function strikeProgress(visual: PlayerVisual, attacking: boolean, nowMs: number): number {
  if (!attacking || visual.swingStartMs === undefined) return 0;
  return Math.min(1, (nowMs - visual.swingStartMs) / STRIKE_DURATION_MS);
}
