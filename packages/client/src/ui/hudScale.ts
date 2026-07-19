/** The single global HUD scale multiplier every HUD widget and screen-anchored entity text reuses. */
// Doubles every HUD element's on-screen size so pixel-font UI stays legible on
// high-density (2K+) displays (docs/VISUAL_DIRECTION.md "pixel font everywhere").
// The shipped default lives in ui/widgets/default-layout.json's "hudScale" field —
// WidgetRegistry falls back to this constant when a layout config omits it. Screen-
// anchored per-entity text (nameplates, hp micro-bars, floating damage numbers) lives
// outside the widget registry entirely, so it imports this same constant directly
// instead of duplicating a second scale knob.
export const HUD_SCALE = 2;
