import { describe, expect, it, vi } from "vitest";
import type { InputConnection } from "../../../input/index.js";
import { Connection } from "../../../net/connection/connection.js";
import { createInputConnectionAdapter } from "./inputAdapters.js";

const REQUIRED_ACTIONS = [
  "interact",
  "revive",
  "pickup",
  "attack",
  "useSlot",
  "useSlotOnPlayer",
  "useItem",
  "throwTorch",
  "craft",
  "stashOp",
  "lootChestOp",
  "partyOp",
  "assignSlot",
  "equip",
  "drop",
  "fistbump",
  "descend",
  "suicide",
  "pushToast",
  "debugGod",
] as const satisfies readonly (keyof InputConnection)[];

describe("production InputConnection adapter", () => {
  it("keeps action gates and body state live after construction", () => {
    const conn = new Connection("wss://example.test", "Adapter", "adapter-client");
    const adapter = createInputConnectionAdapter(conn);
    expect(adapter.canAct).toBe(false);
    expect(adapter.body).toBeNull();

    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.hp = 10;
    conn.body = {
      x: 4, y: 7, z: 0, zVel: 0, grounded: true, coyoteTime: 0,
      jumpBuffer: 0, jumpHeld: false, fallStart: 0, kx: 0, ky: 0,
    };

    expect(adapter.canAct).toBe(true);
    expect(adapter.body).toBe(conn.body);
    conn.hp = 0;
    expect(adapter.canAct).toBe(false);
  });

  it("implements every required action and delegates loot/revive arguments", () => {
    const conn = new Connection("wss://example.test", "Adapter", "adapter-client");
    const lootChestOp = vi.spyOn(conn, "lootChestOp").mockImplementation(() => {});
    const revive = vi.spyOn(conn, "revive").mockImplementation(() => {});
    const adapter = createInputConnectionAdapter(conn);

    for (const action of REQUIRED_ACTIONS) {
      expect(typeof adapter[action], action).toBe("function");
    }
    adapter.lootChestOp("loot-1", "take", "bandage");
    adapter.revive("ally", true);

    expect(lootChestOp).toHaveBeenCalledWith("loot-1", "take", "bandage");
    expect(revive).toHaveBeenCalledWith("ally", true);
  });
});
