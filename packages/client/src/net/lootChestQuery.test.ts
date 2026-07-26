import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "./connection.js";
import {
  activeLootChestNearby,
  canOpenLootChest,
  lootChestLockSeconds,
  nearestLootChest,
} from "./lootChestQuery.js";

const chest = (overrides: Partial<EntitySnapshot> = {}): EntitySnapshot => ({
  id: "loot-1",
  kind: "item",
  defId: "player-loot-chest",
  x: 1,
  y: 0,
  z: 0,
  lootKillerId: "killer",
  lootUnlockAtTick: 1_220,
  ...overrides,
});

const connection = (snapshot = chest()) => ({
  body: { x: 0, y: 0, z: 0 },
  entities: new Map([[snapshot.id, { snap: snapshot, samples: [] }]]),
  serverTick: 20,
  welcome: { playerId: "stranger" },
  stashContext: { kind: "personal", chestId: null },
}) as unknown as Connection;

describe("loot chest client query", () => {
  it("finds only an in-range death chest on the same elevation", () => {
    expect(nearestLootChest(connection())?.id).toBe("loot-1");
    expect(nearestLootChest(connection(chest({ x: 5 })))).toBeNull();
    expect(nearestLootChest(connection(chest({ z: 2 })))).toBeNull();
  });

  it("shows a ceiling-rounded lock while allowing the killer through", () => {
    const conn = connection();
    const snapshot = chest();
    expect(lootChestLockSeconds(snapshot, conn.serverTick)).toBe(60);
    expect(canOpenLootChest(conn, snapshot)).toBe(false);
    conn.welcome = { ...conn.welcome!, playerId: "killer" };
    expect(canOpenLootChest(conn, snapshot)).toBe(true);
  });

  it("keeps a pending panel open, then tracks the selected chest exactly", () => {
    const conn = connection();
    expect(activeLootChestNearby(conn)).toBe(true);
    conn.stashContext = { kind: "loot", chestId: "loot-1" };
    expect(activeLootChestNearby(conn)).toBe(true);
    conn.stashContext = { kind: "loot", chestId: "other" };
    expect(activeLootChestNearby(conn)).toBe(false);
  });
});
