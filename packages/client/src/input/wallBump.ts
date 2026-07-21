// Wall-bump deny cue: a pure edge/throttle state machine (panel round 3b item 4 —
// "blocked movement gives zero cue, all 3 judges hit silent walls"). "Sustained blocked
// input" is inferred purely by comparing intended movement against the actual PREDICTED
// position delta each fixed step — net/prediction.ts itself is untouched, this only
// observes its output. Kept Phaser-free so the throttle/edge-trigger logic is
// unit-testable on its own; scenes/dungeon/index.ts wires it to the real per-step data
// and vfx/index.ts's spawnWallBump cue.

/** Below this, a fixed step's position delta reads as "didn't move" rather than
 * floating-point noise — at TICK_DT=0.05s and the player's real ~8 tiles/sec base speed,
 * an unblocked step covers ~0.4 tiles, so this has enormous margin. */
const STILL_EPSILON_TILES = 0.002;
/** How long a sustained blocked-input press must hold before it earns a cue. */
const SUSTAIN_MS = 150;
/** Re-trigger throttle — holding the key into a wall must not strobe the cue every step. */
const THROTTLE_MS = 400;

export interface WallBumpState {
  blockedSinceMs: number | null;
  lastCueAtMs: number;
}

export function createWallBumpState(): WallBumpState {
  return { blockedSinceMs: null, lastCueAtMs: Number.NEGATIVE_INFINITY };
}

/**
 * Feeds one fixed step's outcome: `moving` is true iff the player held nonzero move
 * intent this step, `deltaDist` is how far the predicted body actually moved (tiles,
 * horizontal only). Mutates `state` in place and returns true exactly on the step that
 * should play the deny cue — the sustain threshold crossing, then not again until the
 * throttle clears.
 */
export function stepWallBump(state: WallBumpState, moving: boolean, deltaDist: number, nowMs: number): boolean {
  const blocked = moving && deltaDist < STILL_EPSILON_TILES;
  if (!blocked) {
    state.blockedSinceMs = null;
    return false;
  }
  if (state.blockedSinceMs === null) state.blockedSinceMs = nowMs;
  if (nowMs - state.blockedSinceMs < SUSTAIN_MS) return false;
  if (nowMs - state.lastCueAtMs < THROTTLE_MS) return false;
  state.lastCueAtMs = nowMs;
  return true;
}
