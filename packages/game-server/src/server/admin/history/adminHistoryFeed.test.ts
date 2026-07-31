import { describe, expect, it } from "vitest";
import { createAdminSession, type AdminSession } from "../access/authorization.js";
import type { AdminAuditHistory, AdminAuditRecord } from "../audit.js";
import { adminHistoryFeed, MAX_ADMIN_HISTORY_ENTRIES } from "./adminHistoryFeed.js";

describe("admin history feed", () => {
  it("returns bounded newest-first records without payloads or target ids", () => {
    const session = createAdminSession();
    const history = new TestHistory(Array.from({ length: 30 }, (_, index) => record(index)));

    const entries = adminHistoryFeed({ session, audit: history, players: [] });

    expect(entries).toHaveLength(MAX_ADMIN_HISTORY_ENTRIES);
    expect(entries[0]).toMatchObject({ at: 29, action: "spawn", ok: false, code: "blocked" });
    expect(entries[0]).not.toHaveProperty("targetIds");
    expect(JSON.stringify(entries)).not.toContain("payload-secret");
  });

  it("uses a server-authoritative current player name for an in-game admin", () => {
    const session = createAdminSession();

    const entries = adminHistoryFeed({
      session,
      audit: new TestHistory([{ ...record(1), operatorPlayerId: "player-1" }]),
      players: [player("player-1", "Austin")],
    });

    expect(entries[0]?.actor).toBe("Austin (in-game admin)");
  });

  it("does not expose history to a session without audit access", () => {
    const session = restrictedSession();

    expect(adminHistoryFeed({ session, audit: new TestHistory([record(1)]), players: [] })).toEqual([]);
  });
});

function record(at: number): AdminAuditRecord {
  return {
    at,
    sessionId: "portal-admin-session-secret",
    command: "spawn",
    targetIds: ["payload-secret"],
    ok: at % 2 === 0,
    ...(at % 2 === 0 ? {} : { code: "blocked" }),
  };
}

function player(playerId: string, name: string) {
  return {
    playerId,
    profileId: "profile-1",
    name,
    level: "dungeon" as const,
    floor: 1,
    x: 0,
    y: 0,
    z: 0,
    hp: 30,
    maxHp: 30,
    downed: false,
    god: false,
    handicapped: false,
    admin: true,
    statuses: [],
    connected: true,
    clientId: "client-1",
  };
}

function restrictedSession(): AdminSession {
  return { ...createAdminSession(), capabilities: new Set(["players:read"]) };
}

class TestHistory implements AdminAuditHistory {
  constructor(private readonly records: readonly AdminAuditRecord[]) {}

  recent(limit: number): readonly AdminAuditRecord[] {
    return this.records.slice(-limit);
  }
}
