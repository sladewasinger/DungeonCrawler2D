// Kill-moment hit-stop: a brief camera zoom-punch so a kill reads with impact
// (VISUAL_DIRECTION "hits feel like hits") — pure timing/magnitude so the curve is
// unit-testable apart from the Phaser camera tween it eventually drives. A true
// engine-wide time-scale pause would touch fixedStep.ts's simulation stepping
// (another lane's file), so this fakes the same punch purely at the camera/render
// layer: a snap-in zoom followed by an equally quick snap-back.
export const HIT_STOP_DURATION_MS = 60;
/** Peak zoom multiplier at the punch's midpoint — subtle, a snap not a lurch. */
export const HIT_STOP_ZOOM = 1.035;

export function isHitStopActive(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs < HIT_STOP_DURATION_MS;
}
