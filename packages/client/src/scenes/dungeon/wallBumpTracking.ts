// Fixed-step wall-bump tracking (panel round 3b item 4) — split out of DungeonScene to
// stay under the file-size cap, same reasoning as frameSync.ts's own doc comment.
// Observes the real predicted-movement delta a fixed step produced (net/prediction.ts
// itself is untouched, this only reads its output) and fires the deny cue once
// input/wallBump.ts's sustain+throttle rules clear.
import type { MoveInput } from "@dc2d/engine";
import { stepWallBump } from "../../input/wallBump.js";
import type { Connection } from "../../net/connection.js";
import type { VfxSystem } from "../../vfx/index.js";
import type { DungeonSceneState } from "./state.js";

/** Skipped while the player can't act (dead/downed): `conn.sampleInput` no-ops then,
 * which would otherwise misread as "blocked" for the whole downed window. */
export function trackWallBump(
  conn: Connection,
  state: DungeonSceneState,
  vfx: VfxSystem,
  move: MoveInput,
  preX: number,
  preY: number,
  nowMs: number,
): void {
  if (!conn.canAct || !conn.body) return;
  const moving = move.moveX !== 0 || move.moveY !== 0;
  const deltaDist = Math.hypot(conn.body.x - preX, conn.body.y - preY);
  if (stepWallBump(state.wallBump, moving, deltaDist, nowMs)) {
    vfx.triggerWallBump(conn.body.x, conn.body.y, move.moveX, move.moveY, nowMs);
  }
}
