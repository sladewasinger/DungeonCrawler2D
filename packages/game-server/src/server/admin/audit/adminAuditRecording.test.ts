import { describe, expect, it } from "vitest";
import type { AdminCommand } from "@dc2d/engine";
import { MemoryAdminAuditSink } from "../audit.js";
import { createAdminSession } from "../access/authorization.js";
import { recordAdminCommand } from "./adminAuditRecording.js";

describe("admin audit recording", () => {
  it.each<AdminCommand>([
    { op: "list" },
    { op: "map", level: "dungeon", floor: 1, x: 4.5, y: 6.5, radius: 10 },
    { op: "spectate", playerId: "player-1" },
    { op: "spectator", action: "start", mode: "track", playerId: "player-1" },
  ])("does not record successful observation command $op", (command) => {
    const audit = new MemoryAdminAuditSink();

    recordAdminCommand(audit, auditInput(command, { ok: true }));

    expect(audit.snapshot()).toEqual([]);
  });

  it("records deliberate admin mutations", () => {
    const audit = new MemoryAdminAuditSink();

    recordAdminCommand(audit, auditInput({ op: "heal", playerId: "player-1" }, { ok: true }));

    expect(audit.snapshot()).toMatchObject([{
      command: "heal",
      targetIds: ["player-1"],
      ok: true,
    }]);
  });

  it("records rejected observation commands for security review", () => {
    const audit = new MemoryAdminAuditSink();
    const map: AdminCommand = {
      op: "map", level: "dungeon", floor: 1, x: 4.5, y: 6.5, radius: 10,
    };

    recordAdminCommand(audit, auditInput(map, { ok: false, code: "forbidden" }));

    expect(audit.snapshot()).toMatchObject([{
      command: "map",
      ok: false,
      code: "forbidden",
    }]);
  });
});

function auditInput(
  command: AdminCommand,
  outcome: { readonly ok: boolean; readonly code?: string },
) {
  return {
    session: createAdminSession(1),
    command,
    outcome,
    operatorPlayerId: null,
  };
}
