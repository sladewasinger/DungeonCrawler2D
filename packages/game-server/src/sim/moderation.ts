import type { GameEvent } from "@dc2d/engine";
import { leaveParty } from "./social.js";
import type { PlayerSlot, SimState } from "./state.js";

const MAX_REPORTS = 500;
export type ModerationOp = "mute" | "unmute" | "block" | "unblock" | "report";

const muted = (slot: PlayerSlot): Set<string> => (slot.mutedPlayers ??= new Set());
const blocked = (slot: PlayerSlot): Set<string> => (slot.blockedPlayers ??= new Set());

export function socialDeliveryAllowed(recipient: PlayerSlot, senderId: string): boolean {
  if (recipient.entity.id === senderId || senderId === "server") return true;
  return !muted(recipient).has(senderId) && !blocked(recipient).has(senderId);
}

export function socialPairAllowed(a: PlayerSlot, b: PlayerSlot): boolean {
  return !blocked(a).has(b.entity.id) && !blocked(b).has(a.entity.id);
}

export function moderationStateEvent(slot: PlayerSlot): GameEvent {
  return {
    t: "moderationUpdated",
    muted: [...muted(slot)].sort(),
    blocked: [...blocked(slot)].sort(),
  };
}

export function sendModerationState(slot: PlayerSlot): void {
  slot.outbox.push(moderationStateEvent(slot));
}

export function doModeration(
  sim: SimState,
  slot: PlayerSlot,
  op: ModerationOp,
  targetId: string,
  reason?: string,
): void {
  const byName = [...sim.players.values()].filter(
    (player) => (player.entity.name ?? "").toLowerCase() === targetId.toLowerCase(),
  );
  const target = sim.players.get(targetId) ?? (byName.length === 1 ? byName[0] : undefined);
  if (!target || target === slot) {
    slot.outbox.push({ t: "toast", msg: "That player is unavailable" });
    return;
  }
  if (op === "mute") muted(slot).add(targetId);
  else if (op === "unmute") muted(slot).delete(targetId);
  else if (op === "block") blockPlayer(sim, slot, target);
  else if (op === "unblock") blocked(slot).delete(targetId);
  else recordReport(sim, slot, target, reason);
  if (op !== "report") sendModerationState(slot);
}

function blockPlayer(sim: SimState, slot: PlayerSlot, target: PlayerSlot): void {
  blocked(slot).add(target.entity.id);
  sim.invites.delete(slot.entity.id);
  const targetInvite = sim.invites.get(target.entity.id);
  if (targetInvite?.from === slot.entity.id) sim.invites.delete(target.entity.id);
  const offeredToSlot = sim.fistbumpOffers.get(slot.entity.id);
  if (offeredToSlot?.from === target.entity.id) sim.fistbumpOffers.delete(slot.entity.id);
  const offeredToTarget = sim.fistbumpOffers.get(target.entity.id);
  if (offeredToTarget?.from === slot.entity.id) sim.fistbumpOffers.delete(target.entity.id);
  if (slot.partyId !== null && slot.partyId === target.partyId) leaveParty(sim, slot);
}

function recordReport(
  sim: SimState,
  reporter: PlayerSlot,
  target: PlayerSlot,
  reason?: string,
): void {
  sim.moderationReports.push({
    tick: sim.tickCount,
    reporterId: reporter.entity.id,
    targetId: target.entity.id,
    reason: reason?.trim() || "Player report",
  });
  if (sim.moderationReports.length > MAX_REPORTS) sim.moderationReports.shift();
  reporter.outbox.push({ t: "toast", msg: `Reported ${target.entity.name ?? "player"}` });
}
