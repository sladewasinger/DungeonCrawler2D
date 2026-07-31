import type { PlayerStore, StoredPlayer } from "../../store.js";

export interface AdminIdentityRecord {
  readonly clientId: string;
  readonly profileId: string;
  readonly name: string;
  readonly adminGranted: boolean;
  readonly handicapGranted: boolean;
  readonly userAgent?: string;
  readonly platform?: string;
  readonly touch?: boolean;
}

export interface AdminIdentityPersistence {
  /** Stable local or provider-linked client identity lookup. */
  find(clientId: string): AdminIdentityRecord | undefined;
  /** Persist the explicit role grant; never infer it from display names/IPs. */
  setAdminGranted(clientId: string, enabled: boolean): boolean;
}

/**
 * Production seam only. An AWS deployment can implement this contract by
 * verifying Cognito claims and storing the role grant in DynamoDB. The local
 * server deliberately does not import AWS SDKs or pretend to provide that
 * infrastructure.
 */
export interface ProductionAdminIdentityAdapter extends AdminIdentityPersistence {
  authenticateProviderToken(token: string): Promise<AdminIdentityRecord | null>;
}

/** Adapter boundary for replacing the local JSON store with durable storage. */
export function playerStoreIdentityPersistence(store: PlayerStore): AdminIdentityPersistence {
  return {
    find: (clientId) => identityRecord(store.find(clientId)),
    setAdminGranted: (clientId, enabled) => setAdminGrant(store, clientId, enabled),
  };
}

/** Explicit name for the complete development adapter. */
export const createLocalAdminIdentityPersistence = playerStoreIdentityPersistence;

function setAdminGrant(store: PlayerStore, clientId: string, enabled: boolean): boolean {
  const player = store.find(clientId);
  if (!player) return false;
  store.recordAdminGrant(player, enabled);
  return true;
}

function identityRecord(player: StoredPlayer | undefined): AdminIdentityRecord | undefined {
  if (!player) return undefined;
  const identity = player.identity;
  return {
    clientId: identity?.clientId ?? "",
    profileId: player.localProfileId ?? `local-profile-${player.slot}`,
    name: player.name,
    adminGranted: player.adminGranted ?? false,
    handicapGranted: player.handicapGranted ?? false,
    ...optionalIdentity(identity),
  };
}

function optionalIdentity(identity: StoredPlayer["identity"]): Pick<AdminIdentityRecord, "userAgent" | "platform" | "touch"> {
  return {
    ...(identity?.userAgent === undefined ? {} : { userAgent: identity.userAgent }),
    ...(identity?.platform === undefined ? {} : { platform: identity.platform }),
    ...(identity?.touch === undefined ? {} : { touch: identity.touch }),
  };
}
