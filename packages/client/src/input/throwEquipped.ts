/**
 * Equipped-throwable input mapping (ASSUMPTION #42, docs/ASSUMPTIONS.md): when the
 * currently equipped weapon is itself throwable (a torch), primary attack throws it
 * instead of swinging — the weapon-orbit/wedge melee presentation only applies to
 * non-throwable weapons. Data-driven off the same `queries.isThrowable` check the
 * hotbar's arm-then-click flow already uses, not a torch-specific special case; the
 * hotbar flow (hotbar.ts) still owns non-equipped throwables (vodka bottle, water
 * flask). Kept pure/Phaser-free so it ports and tests standalone like hotbar.ts.
 */
import type { InputConnection, InputQueries } from "./state.js";

/** True when primary attack should throw the equipped item instead of swinging it. */
export function equippedIsThrowable(conn: InputConnection, queries: InputQueries): boolean {
  return conn.weapon !== null && queries.isThrowable(conn.weapon);
}

/** Desktop aim: direction from the body toward the cursor's world position, in tile
 * units. Connection.throwTorch normalizes it server-protocol-side, mirroring attack(). */
export function throwDirToward(
  body: { x: number; y: number },
  targetWorld: { x: number; y: number },
): { dirX: number; dirY: number } {
  return { dirX: targetWorld.x - body.x, dirY: targetWorld.y - body.y };
}
