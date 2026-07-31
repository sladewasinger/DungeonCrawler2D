import { describe, expect, it } from "vitest";
import {
  ADMIN_MAP_MAX_CELL_COUNT,
  adminMapEntitySchema,
  adminObserverStateSchema,
  clientAdminAuthSchema,
  clientAdminCommandMessageSchema,
  clientAdminLogoutSchema,
  clientAdminResumeSchema,
} from "./wire/admin.js";

describe("admin wire protocol", () => {
  it("accepts auth and bounded commands", () => {
    expect(clientAdminAuthSchema.safeParse({ type: "adminAuth", token: "secret" }).success).toBe(true);
    expect(clientAdminResumeSchema.safeParse({
      type: "adminResume",
      sessionKey: "a".repeat(43),
    }).success).toBe(true);
    expect(clientAdminLogoutSchema.safeParse({ type: "adminLogout" }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({ type: "adminCommand", command: { op: "list" } }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: { op: "spawn", kind: "enemy", defId: "slime", level: "dungeon", floor: 1, x: 1.5, y: 2.5 },
    }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: {
        op: "spawn",
        kind: "pet",
        defId: "pet-dino-tard",
        level: "dungeon",
        floor: 1,
        x: 1.5,
        y: 2.5,
        ownerPlayerId: "player-1",
      },
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
          movementCollision: false,
          attacks: false,
          hitboxPreview: false,
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
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: { op: "spawn", kind: "pet", defId: "pet-dino-tard", level: "dungeon", floor: 1, x: 1.5, y: 2.5 },
    }).success).toBe(false);
    const mapCommand = { op: "map", level: "dungeon", floor: 1, x: 0.5, y: 0.5 };
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: { ...mapCommand, radius: 24 },
    }).success).toBe(true);
    expect(clientAdminCommandMessageSchema.safeParse({
      type: "adminCommand",
      command: { ...mapCommand, radius: 25 },
    }).success).toBe(false);
  });

  it("accepts rectangular hurtboxes and rejects the obsolete circle field", () => {
    const entity = {
      id: "e1",
      kind: "enemy",
      x: 1.5,
      y: 2.5,
      z: 0,
    } as const;

    expect(adminMapEntitySchema.safeParse({
      ...entity,
      debug: { hurtbox: { halfWidth: 0.8, halfDepth: 0.45, height: 1.5, bottomOffset: 0.04 } },
    }).success).toBe(true);
    expect(adminMapEntitySchema.safeParse({
      ...entity,
      debug: { hurtboxRadius: 0.8 },
    }).success).toBe(false);
  });

  it("accepts one bounded maximum-radius admin map payload", () => {
    const cell = {
      x: 0,
      y: 0,
      height: 0,
      walkable: true,
      terrain: "floor",
      feature: 0,
    } as const;
    const map = {
      level: "dungeon",
      floor: 1,
      center: { x: 0.5, y: 0.5 },
      radius: 24,
      cells: Array.from({ length: ADMIN_MAP_MAX_CELL_COUNT }, () => cell),
      entities: [],
    } as const;

    const observer = {
      type: "adminObserverState",
      players: [],
      spectator: { mode: "free", playerId: null },
      spectatorMap: map,
    } as const;

    expect(adminObserverStateSchema.safeParse(observer).success).toBe(true);
    expect(adminObserverStateSchema.safeParse({
      ...observer,
      spectatorMap: { ...map, cells: [...map.cells, cell] },
    }).success).toBe(false);
  });
});
