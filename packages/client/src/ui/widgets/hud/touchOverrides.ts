/**
 * Touch-only registry layout nudges, split out of index.ts's HudWidgets facade to stay
 * under the file-size cap. Desktop never calls this (isTouchDevice() gates the caller).
 */
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

/**
 * Below this logical viewport width, the joystick/action-buttons/bag-toggle cluster
 * scales down further than its default touch size. `resolveLayout` (ui/widgets/layout.ts)
 * rounds every widget's final container scale to the nearest integer so pixel-art icons
 * stay crisp — these three widgets default to finalScale 2 (their own scale 1 x hudScale
 * 2), so the only *other* value integer-rounding can land on is 1, at half the visual
 * footprint. The threshold below is picked so that step lands at phone-portrait widths
 * (~390-430px) and NOT at small-tablet widths (~600px+): factor*hudScale must fall below
 * 1.5 to round down to 1, i.e. narrowAxis below threshold*0.75 = 450px (ASSUMPTION #87).
 * Window panels (inventory/contacts/craft/stash) do NOT get this treatment — they already
 * sit at the same integer floor (1) on touch, so multiplying their scale here would be a
 * silent no-op; stashWindow.ts instead shrinks its own raw panel width directly, the only
 * one of the four wider than a narrow phone's viewport.
 */
const NARROW_VIEWPORT_THRESHOLD = 600;

/**
 * Uses the SMALLER of width/height, not width alone: a landscape phone (844x390) has
 * the same 390px squeeze a portrait one (390x844) does — its own 844px width reads as
 * roomy but isn't the axis anything actually has to fit inside. Both orientations of
 * the same device get the same shrink.
 */
function narrowViewportFactor(viewport: Viewport): number {
  const narrowAxis = Math.min(viewport.width, viewport.height);
  return Math.min(narrowAxis / NARROW_VIEWPORT_THRESHOLD, 1);
}

/** Shrinks/repositions the desktop-sized HUD so the new corner touch controls don't
 * fight it for space: half-scale hotbar (its 400-logical-px width is unavoidably wide
 * at hudScale — see docs/client-proofs/touch-*.png), hidden weapon chip (redundant
 * with the sword-icon ATTACK button), chat lifted clear of the joystick's rest zone,
 * and every centered window panel (inventory/contacts/craft/stash) half-scaled so its
 * doubled hudScale width doesn't run off a ~390px portrait phone. The joystick/buttons/
 * bag-toggle cluster additionally steps down a further narrowViewportFactor() on top of
 * that on narrow phones — call again on resize/orientation-change, not just once at
 * mount, so the factor never goes stale (index.ts's resize()). */
export function applyTouchLayoutOverrides(registry: WidgetRegistry, viewport: Viewport): void {
  const factor = narrowViewportFactor(viewport);
  // The segmented HP bar has no narrow-viewport treatment of its own (unlike status/
  // party below) and at its stock finalScale 2 runs to a 390px phone's edge with zero
  // margin, crowding straight into the top-right telemetry stack (wave-6 sweep:
  // "mobile-hp-bar-runs-to-screen-edge"). Same step-down as the joystick/buttons cluster.
  registry.setOverride("health", { scale: factor });
  registry.setOverride("hotbar", { scale: 0.5 });
  registry.setOverride("weapon", { visible: false });
  registry.setOverride("chat", { offset: { x: 16, y: -150 } });
  registry.setOverride("inventory", { scale: 0.5 });
  registry.setOverride("contacts", { scale: 0.5 });
  registry.setOverride("craft", { scale: 0.5 });
  registry.setOverride("stash", { scale: 0.5 });
  // No override needed here anymore: interactionPrompt.ts's own default (-140) already
  // clears both the collapsed chat chip and the now-smaller touch-buttons cluster in
  // both orientations — an explicit -170/-210 override was chased here at points in
  // wave 6 and each one fixed one orientation while breaking the other (a fixed y can't
  // work for both a 844-tall portrait and a 390-tall landscape at once); the class
  // default already threads the needle (ASSUMPTION #87).
  // At a ~412px-wide portrait viewport the top-left health bar alone is nearly
  // full-width at hudScale (see docs/client-proofs/hud-indicators-mobile.png before
  // this fix), leaving no horizontal gap for the top-right ping/fps/coords stack
  // beside it — drop the stack below the health+buffs cluster instead of squeezing in.
  // Pulled up close to the top edge (y 20, not the desktop default's 16-ish-below-health
  // gap) and narrow-viewport-shrunk like the joystick/buttons above: on a short (390px)
  // landscape phone the right column has to fit status + party + the touch-buttons
  // cluster stacked top-to-bottom with real gaps between all three (wave-6 playtest,
  // ASSUMPTION #87).
  registry.setOverride("status", { offset: { x: -16, y: 20 }, scale: factor });
  // Directly below status's (now narrow-viewport-shrunk) 3-row stack, itself also
  // shrunk so the two together — plus the touch-buttons cluster further down — all fit
  // a 390px-tall landscape phone without overlapping (ASSUMPTION #87).
  registry.setOverride("party", { offset: { x: -16, y: 85 }, scale: factor });
  registry.setOverride("touch-stick", { scale: factor });
  registry.setOverride("touch-buttons", { scale: factor });
  registry.setOverride("inventory-toggle", { scale: factor });
}
