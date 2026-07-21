// Wall-bump sprite nudge (panel round 3b item 4): a tiny (2-3px) push toward the wall
// with an instant return, applied ONLY to the self player's own rendered position
// (scenes/dungeon/frameSync.ts adds this offset to the self view's world x/y) — the
// camera and everything else stay put, so the nudge reads as "you personally bumped",
// not a world shake. Deliberately doesn't touch render/entities or render/terrain
// (another lane's files this wave): the offset is folded into the self view's x/y
// upstream of those renderers, entirely from scenes/dungeon + this module.
const NUDGE_PEAK_TILES = 0.055; // ~2.6px at the game's base 48px/tile (boot/assetManifest.ts SCREEN_TILE_PX)
const NUDGE_OUT_MS = 40;
const NUDGE_TOTAL_MS = 90;

/** 0 before/after the window; ramps 0 -> NUDGE_PEAK_TILES over NUDGE_OUT_MS (the push),
 * then back to 0 by NUDGE_TOTAL_MS (the instant return). */
export function nudgeMagnitude(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= NUDGE_TOTAL_MS) return 0;
  if (elapsedMs <= NUDGE_OUT_MS) return NUDGE_PEAK_TILES * (elapsedMs / NUDGE_OUT_MS);
  return NUDGE_PEAK_TILES * (1 - (elapsedMs - NUDGE_OUT_MS) / (NUDGE_TOTAL_MS - NUDGE_OUT_MS));
}

export class WallBumpNudge {
  private dirX = 0;
  private dirY = 0;
  private triggeredAtMs = Number.NEGATIVE_INFINITY;

  /** Starts a fresh nudge toward (dirX, dirY) — normalized internally, so the caller can
   * pass a raw move-intent vector (e.g. {-1, 1} on a diagonal) directly. */
  trigger(dirX: number, dirY: number, nowMs: number): void {
    const len = Math.hypot(dirX, dirY);
    this.dirX = len > 0 ? dirX / len : 0;
    this.dirY = len > 0 ? dirY / len : 0;
    this.triggeredAtMs = nowMs;
  }

  /** World-tile offset to add to the self view's x/y this frame — {0, 0} outside the window. */
  offset(nowMs: number): { x: number; y: number } {
    const mag = nudgeMagnitude(nowMs - this.triggeredAtMs);
    return { x: this.dirX * mag, y: this.dirY * mag };
  }
}
