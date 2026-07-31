import { describe, expect, it } from "vitest";
import type { AdminCommand } from "@dc2d/engine";
import { authorizeAdminCommand, createAdminSession, type AdminCapability } from "./authorization.js";

describe("admin capability authorization", () => {
  it("requires an authenticated session", () => {
    expect(authorizeAdminCommand(null, { op: "list" })).toEqual({ allowed: false, code: "unauthorized" });
  });

  it("maps commands to capabilities instead of trusting the client", () => {
    const session = { ...createAdminSession(), capabilities: new Set<AdminCapability>(["players:read"]) };
    const list: AdminCommand = { op: "list" };
    const heal: AdminCommand = { op: "heal", playerId: "player-1" };
    expect(authorizeAdminCommand(session, list)).toEqual({ allowed: true });
    expect(authorizeAdminCommand(session, heal)).toEqual({ allowed: false, code: "forbidden" });
  });
});
