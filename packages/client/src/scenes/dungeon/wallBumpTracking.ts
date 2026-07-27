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
export interface WallBumpTrackingInput {
  readonly conn: Connection;
  readonly state: DungeonSceneState;
  readonly vfx: VfxSystem;
  readonly move: MoveInput;
  readonly previousPosition: { x: number; y: number };
  readonly nowMs: number;
}

export function trackWallBump({ conn, state, vfx, move, previousPosition, nowMs }: WallBumpTrackingInput): void {
  if (!conn.canAct || !conn.body) return;
  const moving = move.moveX !== 0 || move.moveY !== 0;
  const deltaDist = Math.hypot(conn.body.x - previousPosition.x, conn.body.y - previousPosition.y);
  if (stepWallBump(state.wallBump, { moving, deltaDist, nowMs })) {
    vfx.triggerWallBump({
      x: conn.body.x,
      y: conn.body.y,
      direction: { x: move.moveX, y: move.moveY },
      nowMs,
    });
  }
}
