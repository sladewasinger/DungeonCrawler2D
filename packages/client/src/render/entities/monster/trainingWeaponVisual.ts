import { getViewOrientation } from "../../view/transform/viewState.js";
import { worldAngleToView } from "../../view/transform/viewTransform.js";
import { updateHeldWeapon } from "../combat/weapon/heldWeapon.js";
import { weaponIconFrame } from "../combat/weapon/weaponIcon.js";
import { combatOverlayPosition } from "../geometry/worldToScreen.js";
import type { MonsterVisual } from "../visuals/state.js";
import type { MonsterEntityView, RenderContext } from "../visuals/view.js";

const STRIKE_DURATION_MS = 160;

/** Presents the configured sword with the same orbit and swing used by players. */
export function updateMonsterTrainingWeapon(
  visual: MonsterVisual,
  view: MonsterEntityView,
  context: RenderContext,
): void {
  const weapon = visual.weapon;
  const weaponId = visual.trainingWeaponId;
  if (!weapon || !weaponId) return;
  const angle = facingAngle(view);
  const striking = view.anim === "attack";
  updateHeldWeapon(weapon, weaponIconFrame(weaponId), {
    screenX: visual.body.x,
    screenY: visual.body.y,
    facingX: view.faceX,
    striking,
    blocking: false,
    attackReadyFlash: false,
    nowMs: context.nowMs,
    strikeProgress: strikeProgress(visual, striking, context.nowMs),
    wielderDepth: visual.body.depth,
    ...combatOverlayPosition({ worldX: view.x, worldY: view.y }),
    orbitAngleRad: angle,
    attackAngleRad: angle,
    isFistFallback: false,
  });
}

function facingAngle(view: MonsterEntityView): number {
  const worldAngle = Math.atan2(view.faceY ?? 0, view.faceX);
  return worldAngleToView(worldAngle, getViewOrientation());
}

function strikeProgress(
  visual: MonsterVisual,
  striking: boolean,
  nowMs: number,
): number {
  if (!striking || visual.telegraphStartMs === undefined) return 0;
  return Math.min(1, (nowMs - visual.telegraphStartMs) / STRIKE_DURATION_MS);
}
