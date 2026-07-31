import { localProfileIdForSlot } from "./storedPlayer.js";
import type { StoredPlayer } from "./store.js";

export interface StashAddRequest {
  item: string;
  qty: number;
  maxStack: number;
}

export function createStoredPlayer(slot: number, name: string): StoredPlayer {
  return {
    slot,
    name,
    stash: [],
    contacts: [],
    xp: 0,
    level: 1,
    deepestFloor: 1,
    activeFloor: 1,
    descentComplete: false,
    localProfileId: localProfileIdForSlot(slot),
    craftedRecipes: {},
    mutedProfileIds: [],
    blockedProfileIds: [],
    adminGranted: false,
    handicapGranted: false,
  };
}

export function addToStash(player: StoredPlayer, request: StashAddRequest, capacity: number): boolean {
  const remaining = fillExistingStacks(player, request);
  return addNewStacks({ player, request, capacity, remaining });
}

function fillExistingStacks(player: StoredPlayer, request: StashAddRequest): number {
  let remaining = request.qty;
  for (const entry of player.stash) {
    if (entry.item !== request.item || entry.qty >= request.maxStack) continue;
    const taken = Math.min(request.maxStack - entry.qty, remaining);
    entry.qty += taken;
    remaining -= taken;
    if (remaining === 0) return 0;
  }
  return remaining;
}

function addNewStacks(state: {
  player: StoredPlayer;
  request: StashAddRequest;
  capacity: number;
  remaining: number;
}): boolean {
  while (state.remaining > 0) {
    if (state.player.stash.length >= state.capacity) return false;
    const qty = Math.min(state.request.maxStack, state.remaining);
    state.player.stash.push({ item: state.request.item, qty });
    state.remaining -= qty;
  }
  return true;
}

export function updateModerationProfile(
  player: StoredPlayer,
  change: { kind: "mutedProfileIds" | "blockedProfileIds"; profileId: string; enabled: boolean },
): boolean {
  const values = (player[change.kind] ??= []);
  const index = values.indexOf(change.profileId);
  if (change.enabled && index < 0) values.push(change.profileId);
  else if (!change.enabled && index >= 0) values.splice(index, 1);
  else return false;
  values.sort();
  return true;
}

export function updateHotbar(
  player: StoredPlayer,
  hotbar: readonly (string | null)[],
  starterHotbarSchema: number | undefined,
): void {
  player.hotbar = [...hotbar];
  if (starterHotbarSchema !== undefined) player.starterHotbarSchema = starterHotbarSchema;
}

export function addPlayerXp(
  player: StoredPlayer,
  amount: number,
  levelForXp: (xp: number) => number,
): { level: number; leveledUp: boolean } {
  const beforeLevel = player.level ?? 1;
  const xp = (player.xp ?? 0) + amount;
  const level = levelForXp(xp);
  player.xp = xp;
  player.level = level;
  return { level, leveledUp: level > beforeLevel };
}
