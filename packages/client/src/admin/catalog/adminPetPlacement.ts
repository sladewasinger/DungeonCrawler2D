import type { AdminMap, AdminPlayer } from "@dc2d/engine";

/** A pet may only be placed for a connected player on the map being edited. */
export function petOwnerForAdminMap(
  player: AdminPlayer | null,
  map: AdminMap | null,
): string | null {
  if (!player || !player.connected || !map) return null;
  return player.level === map.level && player.floor === map.floor
    ? player.playerId
    : null;
}
