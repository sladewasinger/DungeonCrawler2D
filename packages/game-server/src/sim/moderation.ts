import type { GameEvent } from "@dc2d/engine";
import { leaveParty } from "./social/social.js";
import { recordReport } from "./moderation/report.js";
import type { PlayerSlot, SimState } from "./state/state.js";

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

export function doModeration({ sim, slot, op, targetId, reason }: {
  sim: SimState;
  slot: PlayerSlot;
  op: ModerationOp;
  targetId: string;
  reason?: string;
}): void {
  const target = resolveModerationTarget(sim, targetId);
  if (!target || localProfileId(slot) === profileId(target.stored)) {
    slot.outbox.push({ t: "toast", msg: "That player is unavailable" });
    return;
  }
  if (op === "report") {
    recordReport(reason === undefined
      ? { sim, reporter: slot, target: target.stored, profileId }
      : { sim, reporter: slot, target: target.stored, reason, profileId });
    return;
  }
  applyProfileControl({ sim, slot, target, op });
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

function applyProfileControl({ sim, slot, target, op }: {
  sim: SimState;
  slot: PlayerSlot;
  target: ModerationTarget;
  op: Exclude<ModerationOp, "report">;
}): void {
  if (op === "mute") setProfileControl({ sim, slot, target: target.stored, kind: "mutedProfileIds", enabled: true });
  else if (op === "unmute") {
    setProfileControl({ sim, slot, target: target.stored, kind: "mutedProfileIds", enabled: false });
  } else if (op === "block") blockPlayer({ sim, slot, targetStored: target.stored, target: target.slot });
  else setProfileControl({ sim, slot, target: target.stored, kind: "blockedProfileIds", enabled: false });
}

const profileId = (stored: PlayerSlot["stored"]): string =>
  stored.localProfileId ?? `legacy-slot:${stored.slot}`;

const moderationLabel = (op: Exclude<ModerationOp, "report">): string => ({
  mute: "Muted",
  unmute: "Unmuted",
  block: "Blocked",
  unblock: "Unblocked",
})[op];

function setProfileControl({ sim, slot, target, kind, enabled }: {
  sim: SimState;
  slot: PlayerSlot;
  target: PlayerSlot["stored"];
  kind: "mutedProfileIds" | "blockedProfileIds";
  enabled: boolean;
}): void {
  sim.store.recordModerationProfile(slot.stored, { kind, profileId: profileId(target), enabled });
  refreshModerationBindings(sim);
}

function blockPlayer({ sim, slot, targetStored, target }: {
  sim: SimState;
  slot: PlayerSlot;
  targetStored: PlayerSlot["stored"];
  target: PlayerSlot | undefined;
}): void {
  setProfileControl({ sim, slot, target: targetStored, kind: "blockedProfileIds", enabled: true });
  if (!target) return;
  clearPendingSocialState(sim, slot, target);
  if (sameParty(slot, target)) leaveParty(sim, slot);
}

function clearPendingSocialState(sim: SimState, slot: PlayerSlot, target: PlayerSlot): void {
  sim.invites.delete(slot.entity.id);
  removeOfferFrom(sim.invites, target.entity.id, slot.entity.id);
  removeOfferFrom(sim.fistbumpOffers, slot.entity.id, target.entity.id);
  removeOfferFrom(sim.fistbumpOffers, target.entity.id, slot.entity.id);
}

function removeOfferFrom(collection: Map<string, { from: string }>, recipientId: string, senderId: string): void {
  if (collection.get(recipientId)?.from === senderId) collection.delete(recipientId);
}

function sameParty(slot: PlayerSlot, target: PlayerSlot): boolean {
  return slot.partyId !== null && slot.partyId === target.partyId;
}
