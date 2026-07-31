import { describe, expect, it } from "vitest";
import {
  clientAdminAuthSchema,
  clientAdminCommandMessageSchema,
  clientAdminResumeSchema,
} from "./wire/admin.js";

describe("admin wire protocol", () => {
  it("accepts auth and bounded commands", () => {
    expect(clientAdminAuthSchema.safeParse({ type: "adminAuth", token: "secret" }).success).toBe(true);
    expect(clientAdminResumeSchema.safeParse({
      type: "adminResume",
      sessionKey: "a".repeat(43),
    }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({ type: "adminCommand", command: { op: "list" } }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: { op: "spawn", kind: "enemy", defId: "slime", level: "dungeon", floor: 1, x: 1.5, y: 2.5 },
    }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: { op: "despawn", level: "dungeon", floor: 1, entityId: "e9" },
    }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: {
        op: "debug",
        flags: {
          hurtboxes: true,
          attacks: false,
          guards: false,
          lineOfSight: false,
          behavior: false,
          search: false,
          navigation: false,
        },
      },
    }).success).toBe(true);
  });

  it("rejects oversized or malformed admin input", () => {
    expect(clientAdminAuthSchema.safeParse({ type: "adminAuth", token: "" }).success).toBe(false);
    expect(clientAdminResumeSchema.safeParse({
      type: "adminResume",
      sessionKey: "short",
    }).success).toBe(false);
    expect(clientAdminCommandMessageSchema.safeParse({ type: "adminCommand", command: { op: "kill" } }).success).toBe(false);
  });
});
