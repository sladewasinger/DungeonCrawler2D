import { createHash, createHmac } from "node:crypto";

const ANONYMOUS_ACTOR = "anonymous";
const MAX_IDENTIFIER_LENGTH = 128;

/**
 * Keeps DynamoDB partition keys compact and prevents control characters from
 * becoming part of operational history. Player ids remain directly queryable.
 */
export function operationalActorId(actorId: string | null | undefined): string {
  const normalized = actorId ? withoutControlCharacters(actorId).trim() : undefined;
  return normalized ? normalized.slice(0, MAX_IDENTIFIER_LENGTH) : ANONYMOUS_ACTOR;
}

/** A durable audit record must never contain a usable admin session secret. */
export function anonymizedAdminSessionId(sessionId: string): string {
  const digest = createHash("sha256").update(sessionId).digest("hex");
  return `admin-session-${digest.slice(0, 24)}`;
}

/**
 * The raw WebSocket peer address is never persisted. A deployment-specific
 * HMAC key prevents an IP-address dictionary from reversing this identifier.
 */
export function peerFingerprint(peerAddress: string, pepper: string | undefined): string | null {
  if (!pepper) return null;
  const digest = createHmac("sha256", pepper).update(peerAddress).digest("hex");
  return `peer-${digest.slice(0, 24)}`;
}

function withoutControlCharacters(value: string): string {
  return [...value]
    .filter((character) => character.codePointAt(0)! >= 32 && character.codePointAt(0)! !== 127)
    .join("");
}
