// Pure fade curve for the whiff arc-fade cue (panel round 3b item 5, WHIFF FEEDBACK) —
// kept Phaser-free so the curve is unit-testable apart from any Graphics object, same
// split as meleeWedgeGeometry.ts's wedgeAlpha.

/** How long the whiff arc stays visible, fading out over this window. Slightly longer
 * than the connect wedge's own 160ms fade (meleeWedgeGeometry.ts's WEDGE_FADE_MS) so a
 * miss reads as its own distinct beat, not a copy of the swing telegraph fading twice. */
export const WHIFF_FADE_MS = 220;

/** "Faint" per the spec — half the wedge's usual full-bright peak. */
export const WHIFF_PEAK_ALPHA = 0.5;

/** WHIFF_PEAK_ALPHA at spawn, linearly fading to 0 by WHIFF_FADE_MS; 0 before spawn or once fully faded. */
export function whiffAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= WHIFF_FADE_MS) return 0;
  return WHIFF_PEAK_ALPHA * (1 - elapsedMs / WHIFF_FADE_MS);
}
