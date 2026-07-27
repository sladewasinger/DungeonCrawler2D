import type { StoredPlayer } from "./store.js";
import type { StoredFilePlayer } from "./storeFileSchemas.js";

export function storedPlayer(player: StoredFilePlayer): StoredPlayer {
  return {
    slot: player.slot,
    name: player.name,
    stash: player.stash,
    contacts: player.contacts ?? [],
    ...(player.hotbar === undefined ? {} : { hotbar: player.hotbar }),
    ...(player.starterHotbarSchema === undefined ? {} : { starterHotbarSchema: player.starterHotbarSchema }),
    ...(player.xp === undefined ? {} : { xp: player.xp }),
    ...(player.level === undefined ? {} : { level: player.level }),
    ...(player.deepestFloor === undefined ? {} : { deepestFloor: player.deepestFloor }),
    ...descentState(player),
    ...profileState(player),
  };
}

function descentState(player: StoredFilePlayer): Pick<StoredPlayer, "activeFloor" | "descentComplete"> {
  if (hasDescentState(player)) {
    return { activeFloor: player.activeFloor, descentComplete: player.descentComplete };
  }
  return { activeFloor: 1, descentComplete: false };
}

function hasDescentState(player: StoredFilePlayer): player is StoredFilePlayer & {
  activeFloor: number;
  descentComplete: boolean;
} {
  return "activeFloor" in player
    && typeof player.activeFloor === "number"
    && "descentComplete" in player
    && typeof player.descentComplete === "boolean";
}

function profileState(player: StoredFilePlayer): Pick<
  StoredPlayer,
  "localProfileId" | "craftedRecipes" | "mutedProfileIds" | "blockedProfileIds"
> {
  if ("localProfileId" in player && typeof player.localProfileId === "string") {
    return {
      localProfileId: player.localProfileId,
      craftedRecipes: player.craftedRecipes,
      mutedProfileIds: player.mutedProfileIds,
      blockedProfileIds: player.blockedProfileIds,
    };
  }
  return {
    localProfileId: `local-profile-${player.slot}`,
    craftedRecipes: {},
    mutedProfileIds: [],
    blockedProfileIds: [],
  };
}
