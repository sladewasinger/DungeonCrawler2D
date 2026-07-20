/**
 * Drives the fistbump hold-progress ring from live input + connection state —
 * split out of DungeonScene to stay under the file-size cap.
 */
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { FistbumpRing } from "./fistbumpRing.js";

/** Roughly above the target's head, matching the flourish/nameplate placement elsewhere. */
const RING_HEAD_OFFSET_TILES = 1.3;

/** Resolves the in-progress F-hold (if any) to a screen position and redraws the ring. */
export function syncFistbumpRing(ring: FistbumpRing, inputController: InputController, conn: Connection): void {
  const hold = inputController.fistbumpHoldView();
  const target = hold ? conn.entities.get(hold.targetId)?.snap : undefined;
  if (!hold || !target) {
    ring.update(null);
    return;
  }
  const screen = worldToScreen(target.x, target.y - RING_HEAD_OFFSET_TILES);
  ring.update({ x: screen.x, y: screen.y, progress: hold.progress });
}
