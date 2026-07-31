import type { StoredPlayer } from "./store.js";

export const localProfileIdForSlot = (slot: number): string => `local-profile-${slot}`;

const progressionDefaults = (
  player: StoredPlayer,
): Pick<StoredPlayer, "contacts" | "xp" | "level" | "deepestFloor" | "activeFloor"
  | "descentComplete"> => ({
  contacts: player.contacts ?? [],
  xp: player.xp ?? 0,
  level: player.level ?? 1,
  deepestFloor: player.deepestFloor ?? 1,
  activeFloor: player.activeFloor ?? 1,
  descentComplete: player.descentComplete ?? false,
});

const profileDefaults = (
  player: StoredPlayer,
): Pick<StoredPlayer, "localProfileId" | "craftedRecipes" | "mutedProfileIds"
  | "blockedProfileIds"> => ({
  localProfileId: player.localProfileId ?? localProfileIdForSlot(player.slot),
  craftedRecipes: { ...(player.craftedRecipes ?? {}) },
  mutedProfileIds: [...(player.mutedProfileIds ?? [])],
  blockedProfileIds: [...(player.blockedProfileIds ?? [])],
});

const identityDefaults = (player: StoredPlayer): Pick<StoredPlayer, "identity" | "adminGranted" | "handicapGranted"> => ({
  ...(player.identity ? { identity: { ...player.identity } } : {}),
  adminGranted: player.adminGranted ?? false,
  handicapGranted: player.handicapGranted ?? false,
});

const optionalEquipment = (
  player: StoredPlayer,
): Pick<StoredPlayer, "hotbar" | "starterHotbarSchema"> => ({
  ...(Array.isArray(player.hotbar) ? { hotbar: [...player.hotbar] } : {}),
  ...(player.starterHotbarSchema === undefined
    ? {}
    : { starterHotbarSchema: player.starterHotbarSchema }),
});

export const normalizeStoredPlayer = (player: StoredPlayer): StoredPlayer => ({
  ...player,
  ...progressionDefaults(player),
  ...profileDefaults(player),
  ...identityDefaults(player),
  ...optionalEquipment(player),
});
