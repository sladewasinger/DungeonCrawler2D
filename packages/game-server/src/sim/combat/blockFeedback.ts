import type { Entity, GameEvent } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";

export type BlockFeedbackKind = "melee" | "projectile";

export function notifyBlockFeedback(
  sim: SimState,
  victim: Entity,
  kind: BlockFeedbackKind,
): void {
  if (victim.kind !== "player") return;
  const slot = sim.players.get(victim.id);
  if (slot) pushBlockFeedback(slot, kind);
}

function pushBlockFeedback(slot: PlayerSlot, kind: BlockFeedbackKind): void {
  const event: GameEvent = { t: "blockFeedback", kind };
  slot.outbox.push(event);
}
