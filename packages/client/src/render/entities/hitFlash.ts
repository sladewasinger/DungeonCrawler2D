// White hit-flash: a short, edge-triggered strobe when hp drops between snapshots —
// VISUAL_DIRECTION's "hits feel like hits" requirement, decoupled from any Phaser call
// so the timing/trigger logic is unit-testable on its own.
export const HIT_FLASH_DURATION_MS = 140;

/** True if hp dropped since the last sample — a hit landed. The caller starts the flash timer on this edge. */
export function tookDamage(previousHp: number | undefined, currentHp: number): boolean {
  return previousHp !== undefined && currentHp < previousHp;
}

/** 0..1 flash intensity for elapsed ms since the flash started; 0 once it has finished (or before it started). */
export function flashIntensity(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= HIT_FLASH_DURATION_MS) return 0;
  return 1 - elapsedMs / HIT_FLASH_DURATION_MS;
}
