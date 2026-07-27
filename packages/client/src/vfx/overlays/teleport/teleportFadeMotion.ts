// Fade-through-black timing curve for any teleport (doors, and Epic 7.14's stairway
// descent/ascend, which reuses the same "teleported" wire event — net/apply.ts):
// snap to black fast, hold briefly while the scene rebuilds underneath, fade back in.

export const TELEPORT_FADE_LIFETIME_MS = 500;
const FADE_OUT_MS = 120;
const HOLD_MS = 120;

export function isTeleportFadeExpired(elapsedMs: number): boolean {
  return elapsedMs >= TELEPORT_FADE_LIFETIME_MS;
}

/** Black overlay alpha: snaps to fully opaque, holds, then eases back to transparent. */
export function teleportFadeAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= TELEPORT_FADE_LIFETIME_MS) return 0;
  if (elapsedMs < FADE_OUT_MS) return elapsedMs / FADE_OUT_MS;
  if (elapsedMs < FADE_OUT_MS + HOLD_MS) return 1;
  const fadeInStart = FADE_OUT_MS + HOLD_MS;
  return 1 - (elapsedMs - fadeInStart) / (TELEPORT_FADE_LIFETIME_MS - fadeInStart);
}
