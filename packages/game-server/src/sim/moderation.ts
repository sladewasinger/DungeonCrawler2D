import type { GameEvent } from "@dc2d/engine";
import { leaveParty } from "./social.js";
import type { PlayerSlot, SimState } from "./state.js";

const MAX_REPORTS = 500;
export type ModerationOp = "mute" | "unmute" | "block" | "unblock" | "report";

const muted = (slot: PlayerSlot): Set<string> => (slot.mutedPlayers ??= new Set());
const blocked = (slot: PlayerSlot): Set<string> => (slot.blockedPlayers ??= new Set());
export const localProfileId = (slot: PlayerSlot): string =>
  slot.stored.localProfileId ?? `legacy-client:${slot.clientId}`;

export function socialDeliveryAllowed(recipient: PlayerSlot, senderId: string): boolean {
  if (recipient.entity.id === senderId || senderId === "server") return true;
  return !muted(recipient).has(senderId) && !blocked(recipient).has(senderId);
}

export function socialPairAllowed(a: PlayerSlot, b: PlayerSlot): boolean {
  return !blocked(a).has(b.entity.id) && !blocked(b).has(a.entity.id);
}

export function socialDeliveryAllowedProfile(
  recipient: PlayerSlot,
  senderProfileId: string | undefined,
): boolean {
  if (!senderProfileId) return true;
  return !(recipient.stored.mutedProfileIds ?? []).includes(senderProfileId)
    && !(recipient.stored.blockedProfileIds ?? []).includes(senderProfileId);
}

/** Rebind stable persisted profile ids to this sim's transient entity ids. */
export function refreshModerationBindings(sim: SimState): void {
  const players = [...sim.players.values()];
  for (const recipient of players) {
    const mutedProfiles = new Set(recipient.stored.mutedProfileIds ?? []);
    const blockedProfiles = new Set(recipient.stored.blockedProfileIds ?? []);
    const nextMuted = new Set(
      players.filter((player) => mutedProfiles.has(localProfileId(player)))
        .map((player) => player.entity.id),
    );
    const nextBlocked = new Set(
      players.filter((player) => blockedProfiles.has(localProfileId(player)))
        .map((player) => player.entity.id),
    );
    const changed = !sameSet(muted(recipient), nextMuted)
      || !sameSet(blocked(recipient), nextBlocked);
    recipient.mutedPlayers = nextMuted;
    recipient.blockedPlayers = nextBlocked;
    if (changed && recipient.connected) sendModerationState(recipient);
  }
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((value) => b.has(value));

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
  const target = resolveModerationTarget(sim, targetId);
  if (!target || localProfileId(slot) === profileId(target.stored)) {
    slot.outbox.push({ t: "toast", msg: "That player is unavailable" });
    return;
  }
  if (op === "report") {
    recordReport(sim, slot, target.stored, reason);
    return;
  }
  applyProfileControl(sim, slot, target, op);
  slot.outbox.push({ t: "toast", msg: `${moderationLabel(op)} ${target.stored.name}` });
  sendModerationState(slot);
}

interface ModerationTarget {
  stored: PlayerSlot["stored"];
  slot?: PlayerSlot;
}

function resolveModerationTarget(sim: SimState, targetId: string): ModerationTarget | undefined {
  const byName = [...sim.players.values()].filter(
    (player) => (player.entity.name ?? "").toLowerCase() === targetId.toLowerCase(),
  );
  const targetSlot = sim.players.get(targetId) ?? (byName.length === 1 ? byName[0] : undefined);
  const targetStored = targetSlot?.stored ?? sim.store.findUniqueByName(targetId);
  return targetStored ? { stored: targetStored, ...(targetSlot ? { slot: targetSlot } : {}) }
    : undefined;
}

function applyProfileControl(
  sim: SimState,
  slot: PlayerSlot,
  target: ModerationTarget,
  op: Exclude<ModerationOp, "report">,
): void {
  if (op === "mute") setProfileControl(sim, slot, target.stored, "mutedProfileIds", true);
  else if (op === "unmute") {
    setProfileControl(sim, slot, target.stored, "mutedProfileIds", false);
  } else if (op === "block") blockPlayer(sim, slot, target.stored, target.slot);
  else setProfileControl(sim, slot, target.stored, "blockedProfileIds", false);
}

const profileId = (stored: PlayerSlot["stored"]): string =>
  stored.localProfileId ?? `legacy-slot:${stored.slot}`;

const moderationLabel = (op: Exclude<ModerationOp, "report">): string => ({
  mute: "Muted",
  unmute: "Unmuted",
  block: "Blocked",
  unblock: "Unblocked",
})[op];

function setProfileControl(
  sim: SimState,
  slot: PlayerSlot,
  target: PlayerSlot["stored"],
  kind: "mutedProfileIds" | "blockedProfileIds",
  enabled: boolean,
): void {
  sim.store.recordModerationProfile(slot.stored, kind, profileId(target), enabled);
  refreshModerationBindings(sim);
}

function blockPlayer(
  sim: SimState,
  slot: PlayerSlot,
  targetStored: PlayerSlot["stored"],
  target: PlayerSlot | undefined,
): void {
  setProfileControl(sim, slot, targetStored, "blockedProfileIds", true);
  if (!target) return;
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
  target: PlayerSlot["stored"],
  reason?: string,
): void {
  sim.moderationReports.push({
    tick: sim.tickCount,
    reporterId: reporter.entity.id,
    targetId: profileId(target),
    reason: reason?.trim() || "Player report",
  });
  if (sim.moderationReports.length > MAX_REPORTS) sim.moderationReports.shift();
  reporter.outbox.push({ t: "toast", msg: `Reported ${target.name}` });
}
