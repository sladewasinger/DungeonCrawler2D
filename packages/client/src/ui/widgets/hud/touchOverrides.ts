/**
 * Touch-only registry layout nudges, split out of index.ts's HudWidgets facade to stay
 * under the file-size cap. Desktop never calls this (isTouchDevice() gates the caller).
 */
import type { WidgetRegistry } from "../registry.js";

/** Shrinks/repositions the desktop-sized HUD so the new corner touch controls don't
 * fight it for space: half-scale hotbar (its 400-logical-px width is unavoidably wide
 * at hudScale — see docs/client-proofs/touch-*.png), hidden weapon chip (redundant
 * with the sword-icon ATTACK button), chat lifted clear of the joystick's rest zone,
 * and every centered window panel (inventory/contacts/craft/stash) half-scaled so its
 * doubled hudScale width doesn't run off a ~390px portrait phone. */
export function applyTouchLayoutOverrides(registry: WidgetRegistry): void {
  registry.setOverride("hotbar", { scale: 0.5 });
  registry.setOverride("weapon", { visible: false });
  registry.setOverride("chat", { offset: { x: 16, y: -150 } });
  registry.setOverride("inventory", { scale: 0.5 });
  registry.setOverride("contacts", { scale: 0.5 });
  registry.setOverride("craft", { scale: 0.5 });
  registry.setOverride("stash", { scale: 0.5 });
  // Clears the touch-buttons cluster's top edge (touchButtons.ts) instead of sitting
  // right on top of it — only reachable on the ?camera=entities gallery preset /
  // standing near a pickup in real play, but real play hits it too.
  registry.setOverride("interaction", { offset: { x: 0, y: -170 } });
  // At a ~412px-wide portrait viewport the top-left health bar alone is nearly
  // full-width at hudScale (see docs/client-proofs/hud-indicators-mobile.png before
  // this fix), leaving no horizontal gap for the top-right ping/fps/coords stack
  // beside it — drop the stack below the health+buffs cluster instead of squeezing in.
  registry.setOverride("status", { offset: { x: -16, y: 100 } });
}
