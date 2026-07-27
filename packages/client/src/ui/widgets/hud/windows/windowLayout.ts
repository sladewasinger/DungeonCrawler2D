/**
 * Shared sizing/placement for the four fixed "centered" window panels
 * (inventory/contacts/craft/stash) — pure constants, no Phaser, so they're
 * unit-testable without a scene.
 */

/**
 * One shared panel height for all four windows, sized so that at the shipped
 * hudScale (2) on the 1280x720 reference viewport, BOTH ends of the widget fit on
 * screen with real margin: closeButton.ts's hit box floats HIT_SIZE/2 + CLEARANCE +
 * HIT_SIZE/2 = 34px (unscaled) above the panel's own top edge, and the panel's
 * bottom edge must clear the hotbar's reserved band. A window taller than this
 * cannot satisfy both at once (the close button goes off-screen if the panel is
 * repositioned up to clear the hotbar, or the panel overlaps the hotbar if the
 * close button is kept fully visible) — verified by construction in
 * windowLayout.test.ts. Reusing one height instead of four independently-tuned
 * ones also reads as one deliberate panel size, not four windows quietly drifting
 * apart (wave-6 sweep: "hud-window-overlaps-hotbar" / "contacts-window-overlaps-hotbar").
 */
export const WINDOW_PANEL_HEIGHT = 250;

/**
 * Vertical offset (unscaled — same units as every WidgetDefinition.defaultOffset;
 * ui/widgets/layout.ts's resolveLayout multiplies it by hudScale) that centers a
 * WINDOW_PANEL_HEIGHT-tall panel, plus its floating close button, in the gap
 * between the screen top and the hotbar: ~10px clearance above the close button's
 * hit box, ~14px clearance above the hotbar at the reference viewport/hudScale.
 */
export const WINDOW_VERTICAL_OFFSET = -16;
