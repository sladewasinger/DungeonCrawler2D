import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "../connection/connection.js";
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

const connection = (...snapshots: EntitySnapshot[]) => ({
  body: { x: 0, y: 0, z: 0 },
  entities: new Map(
    (snapshots.length > 0 ? snapshots : [chest()])
      .map((snapshot) => [snapshot.id, { snap: snapshot, samples: [] }]),
  ),
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

  it("selects the nearest chest with a stable id tie-break", () => {
    const farther = chest({ id: "loot-a", x: 1.4 });
    const nearer = chest({ id: "loot-z", x: 0.4 });
    expect(nearestLootChest(connection(farther, nearer))?.id).toBe("loot-z");

    const tieB = chest({ id: "loot-b", x: 1 });
    const tieA = chest({ id: "loot-a", x: -1 });
    expect(nearestLootChest(connection(tieB, tieA))?.id).toBe("loot-a");
    expect(nearestLootChest(connection(tieA, tieB))?.id).toBe("loot-a");
  });

  it("shows a ceiling-rounded lock while allowing the killer through", () => {
    const conn = connection();
    const snapshot = chest();
    expect(lootChestLockSeconds(snapshot, conn.serverTick)).toBe(60);
    expect(canOpenLootChest(conn, snapshot)).toBe(false);
    const welcome = conn.welcome;
    if (!welcome) throw new Error("expected welcome");
    conn.welcome = { ...welcome, playerId: "killer" };
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
