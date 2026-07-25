import type { SimState } from "./state.js";

export function createEntityCollections(): Pick<
  SimState,
  "players" | "byToken" | "enemies" | "items" | "projectiles"
  | "torches" | "parties" | "invites"
> {
  return {
    players: new Map(),
    byToken: new Map(),
    enemies: new Map(),
    items: new Map(),
    projectiles: new Map(),
    torches: new Map(),
    parties: new Map(),
    invites: new Map(),
  };
}

export function createReplicationCollections(): Pick<
  SimState,
  "snapshotClients" | "snapshotEntities" | "snapshotPending" | "replicationMotion"
> {
  return {
    snapshotClients: new Map(),
    snapshotEntities: new Map(),
    snapshotPending: new Map(),
    replicationMotion: new Map(),
  };
}
