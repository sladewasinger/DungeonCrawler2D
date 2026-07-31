import type { PlayerIdentityMetadata, StoredPlayer } from "./store.js";

export type PlayerIdentityInput = Omit<PlayerIdentityMetadata, "clientId" | "lastSeenAt">;

export function updatePlayerIdentity(
  player: StoredPlayer,
  clientId: string,
  metadata: PlayerIdentityInput | undefined,
): boolean {
  if (!metadata) return false;
  const previous = player.identity;
  player.identity = { clientId, ...metadata, lastSeenAt: Date.now() };
  return previous?.userAgent !== metadata.userAgent ||
    previous?.platform !== metadata.platform ||
    previous?.touch !== metadata.touch;
}
