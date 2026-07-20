/**
 * Drives the revive hold-progress ring from live input + connection state — mirrors
 * fistbumpRingSync.ts's pattern, sourced from the party snapshot's own x/y instead of
 * conn.entities: a downed teammate's revive prompt shouldn't depend on AOI entity
 * replication when the party ping already carries position.
 */
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { FistbumpRing } from "./fistbumpRing.js";

/** Roughly above the target's head, matching the fistbump ring's placement. */
const RING_HEAD_OFFSET_TILES = 1.3;

/** Resolves the in-progress E-hold (if any) to a screen position and redraws the ring. */
export function syncReviveRing(ring: FistbumpRing, inputController: InputController, conn: Connection): void {
  const hold = inputController.reviveHoldView();
  const target = hold ? conn.party?.members.find((m) => m.id === hold.targetId) : undefined;
  if (!hold || !target) {
    ring.update(null);
    return;
  }
  const screen = worldToScreen(target.x, target.y - RING_HEAD_OFFSET_TILES);
  ring.update({ x: screen.x, y: screen.y, progress: hold.progress });
}
