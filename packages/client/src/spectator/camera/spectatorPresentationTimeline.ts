export const SPECTATOR_PRESENTATION_DELAY_MS = 125;

/** Keeps every spectator-presented entity on one buffered timeline. */
export function spectatorPresentationDelay(adaptiveDelayMs: number): number {
  return Math.max(SPECTATOR_PRESENTATION_DELAY_MS, adaptiveDelayMs);
}
