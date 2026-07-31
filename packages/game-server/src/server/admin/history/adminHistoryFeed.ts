import type { AdminHistoryEntry, AdminPlayer } from "@dc2d/engine";
import { canReadAdminHistory, type AdminSession } from "../access/authorization.js";
import type { AdminAuditHistory, AdminAuditRecord } from "../audit.js";

export const MAX_ADMIN_HISTORY_ENTRIES = 24;

export interface AdminHistoryFeedInput {
  readonly session: AdminSession | null;
  readonly audit: AdminAuditHistory;
  readonly players: readonly AdminPlayer[];
}

/**
 * Gives an authenticated operator a small, redacted audit view. The durable
 * operational sink receives the same records separately; this feed never
 * exposes continuation keys, command payloads, target ids, or request ids.
 */
export function adminHistoryFeed(input: AdminHistoryFeedInput): readonly AdminHistoryEntry[] {
  if (!canReadAdminHistory(input.session)) return [];
  const playersById = new Map(input.players.map((player) => [player.playerId, player]));
  return input.audit.recent(MAX_ADMIN_HISTORY_ENTRIES)
    .slice(-MAX_ADMIN_HISTORY_ENTRIES)
    .toReversed()
    .map((record) => adminHistoryEntry(record, playersById));
}

function adminHistoryEntry(
  record: AdminAuditRecord,
  players: ReadonlyMap<string, AdminPlayer>,
): AdminHistoryEntry {
  return {
    at: record.at,
    actor: historyActor(record, players),
    action: boundedAction(record.command),
    ok: record.ok,
    ...(record.code ? { code: boundedCode(record.code) } : {}),
  };
}

function historyActor(
  record: AdminAuditRecord,
  players: ReadonlyMap<string, AdminPlayer>,
): string {
  const player = record.operatorPlayerId ? players.get(record.operatorPlayerId) : undefined;
  if (player) return `${player.name} (in-game admin)`;
  if (record.operatorPlayerId) return "In-game admin";
  return `Portal admin · session ${shortSessionId(record.sessionId)}`;
}

function shortSessionId(sessionId: string): string {
  return sessionId.slice(0, 8).replace(/[^A-Za-z0-9]/g, "");
}

function boundedAction(value: string): string {
  return value.slice(0, 32) || "admin";
}

function boundedCode(value: string): string {
  return value.slice(0, 32) || "rejected";
}
