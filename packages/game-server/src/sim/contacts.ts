import { AOI_RADIUS, TICK_RATE, type GameEvent } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";
import { socialPairAllowed } from "./moderation.js";

/** Fistbump contacts (Epic 7.10) and /who — hold-gesture mutual contact,
 * pending-offer bookkeeping, and the shared chat rate-limit helper. */

/** SHARED CONTRACT (wave 3 brief): genuine physical contact, 2 tiles. */
const FISTBUMP_RANGE_TILES = 2;
const OFFER_TTL_TICKS = 10 * TICK_RATE;
const OFFER_COOLDOWN_TICKS = 2 * TICK_RATE;
/** Rate limit (docs/ASSUMPTIONS.md #46 — supersedes #16's channel-split
 * default): one flat cap shared by every chat channel AND /who, since a
 * /who response is itself a system chat line and its player scan isn't free. */
export const CHAT_LIMIT = 5;
export const RATE_WINDOW_TICKS = 3 * TICK_RATE;

/** Rolling-window rate limit: prunes stale timestamps in place, then
 * records+allows iff still under `limit`. A slot can cross between floor
 * simulations with different tick origins, so future timestamps reset the old
 * clock domain instead of permanently locking that player out. */
interface RateLimitRequest {
  timestamps: number[];
  nowTick: number;
  windowTicks: number;
  limit: number;
}

export function withinRateLimit({ timestamps, nowTick, windowTicks, limit }: RateLimitRequest): boolean {
  if (timestamps.some((timestamp) => timestamp > nowTick)) timestamps.length = 0;
  while (timestamps.length > 0 && timestamps[0]! <= nowTick - windowTicks) timestamps.shift();
  if (timestamps.length >= limit) return false;
  timestamps.push(nowTick);
  return true;
}

/** Connected players whose name matches case-insensitively (for /dm targeting + ambiguity). */
export function findOnlineByName(sim: SimState, name: string): PlayerSlot[] {
  const lower = name.toLowerCase();
  return [...sim.players.values()].filter(
    (p) => p.connected && (p.entity.name ?? "").toLowerCase() === lower,
  );
}

export function doFistbump(sim: SimState, slot: PlayerSlot, targetId: string): void {
  const target = fistbumpTarget(sim, slot, targetId);
  if (!target) return;

  const incoming = sim.fistbumpOffers.get(slot.entity.id);
  if (incoming && incoming.from === target.entity.id && incoming.expiresAtTick >= sim.tickCount) {
    sealMutualContact(sim, slot, target);
    return;
  }
  offerFistbump(sim, slot, target);
}

function fistbumpTarget(sim: SimState, slot: PlayerSlot, targetId: string): PlayerSlot | null {
  const target = sim.players.get(targetId);
  if (!target || !target.connected || target.entity.id === slot.entity.id) return null;
  if (!socialPairAllowed(slot, target)) return null;
  const distance = Math.hypot(
    target.entity.body.x - slot.entity.body.x,
    target.entity.body.y - slot.entity.body.y,
  );
  return distance <= FISTBUMP_RANGE_TILES ? target : null;
}

function offerFistbump(sim: SimState, slot: PlayerSlot, target: PlayerSlot): void {
  if (sim.tickCount - slot.lastFistbumpOfferAtTick < OFFER_COOLDOWN_TICKS) {
    slot.outbox.push(systemLine("Easy — wait a moment before offering another fistbump."));
    return;
  }
  slot.lastFistbumpOfferAtTick = sim.tickCount;
  sim.fistbumpOffers.set(target.entity.id, {
    from: slot.entity.id,
    expiresAtTick: sim.tickCount + OFFER_TTL_TICKS,
  });
  const senderName = slot.entity.name ?? "?";
  target.outbox.push(systemLine(`${senderName} offers a fistbump — hold F back to seal it`));
  slot.outbox.push(systemLine(`You offer ${target.entity.name ?? "?"} a fistbump.`));
}

function sealMutualContact(sim: SimState, a: PlayerSlot, b: PlayerSlot): void {
  sim.fistbumpOffers.delete(a.entity.id);
  const aName = a.entity.name ?? "?";
  const bName = b.entity.name ?? "?";
  sim.store.addContact(a.stored, bName);
  sim.store.addContact(b.stored, aName);
  a.outbox.push(systemLine(`You and ${bName} are now contacts!`));
  b.outbox.push(systemLine(`You and ${aName} are now contacts!`));
  sendContactsUpdated(sim, a);
  sendContactsUpdated(sim, b);
}

export function sendContactsUpdated(sim: SimState, slot: PlayerSlot): void {
  const contacts = slot.stored.contacts.flatMap((name) => {
    const matches = findOnlineByName(sim, name);
    const match = matches.length === 1 ? matches[0] : undefined;
    if (match && !socialPairAllowed(slot, match)) return [];
    return [{
      name,
      online: matches.length > 0,
      ...(match ? { id: match.entity.id } : {}),
    }];
  });
  slot.outbox.push({ t: "contactsUpdated", contacts });
}

/** Epic 7.14 (The Descent): /who's "online" list spans every floor of the
 * dungeon (sim.crossFloorDirectory, refreshed each tick by FloorRegistry)
 * so "shows floor per player" is meaningful; "nearby" stays a same-floor
 * AOI count (cross-floor proximity is meaningless spatially). Sims not
 * under a registry (sandbox, bare unit tests) fall back to their own
 * `players` map, tagged with their own floor. */
export function doWho(sim: SimState, slot: PlayerSlot): void {
  if (!withinRateLimit({
    timestamps: slot.chatTimestamps,
    nowTick: sim.tickCount,
    windowTicks: RATE_WINDOW_TICKS,
    limit: CHAT_LIMIT,
  })) {
    slot.outbox.push(systemLine("You're sending messages too fast — slow down."));
    return;
  }
  const connectedHere = connectedPlayers(sim);
  const visibleDirectory = visibleDirectoryFor(sim, slot, connectedHere);
  const nearby = nearbyPlayerCount(slot, connectedHere);
  const names = [...visibleDirectory]
    .sort((x, y) => x.name.localeCompare(y.name))
    .map((p) => `${p.name} (F${p.floor})`);
  slot.outbox.push(
    systemLine(`Online (${visibleDirectory.length}, ${nearby} nearby): ${names.join(", ")}`),
  );
}

function connectedPlayers(sim: SimState): PlayerSlot[] {
  return [...sim.players.values()].filter((player) => player.connected);
}

function visibleDirectoryFor(sim: SimState, slot: PlayerSlot, connectedHere: PlayerSlot[]) {
  const directory = sim.crossFloorDirectory.length > 0
    ? sim.crossFloorDirectory
    : connectedHere.map((player) => ({
      name: player.entity.name ?? "?",
      floor: sim.world.floor,
      profileId: player.stored.localProfileId,
    }));
  const blocked = new Set(slot.stored.blockedProfileIds ?? []);
  return directory.filter((player) => !player.profileId || !blocked.has(player.profileId));
}

function nearbyPlayerCount(slot: PlayerSlot, players: PlayerSlot[]): number {
  return players.filter((player) => player !== slot && distanceTo(slot, player) <= AOI_RADIUS).length;
}

function distanceTo(a: PlayerSlot, b: PlayerSlot): number {
  return Math.hypot(a.entity.body.x - b.entity.body.x, a.entity.body.y - b.entity.body.y);
}

/** Drop offers nobody sealed in time — call once per tick, mirrors expireInvites. */
export function expireFistbumpOffers(sim: SimState): void {
  for (const [targetId, offer] of sim.fistbumpOffers) {
    if (offer.expiresAtTick < sim.tickCount) sim.fistbumpOffers.delete(targetId);
  }
}

function systemLine(text: string): GameEvent {
  return { t: "chat", channel: "system", from: "server", name: "system", text };
}
