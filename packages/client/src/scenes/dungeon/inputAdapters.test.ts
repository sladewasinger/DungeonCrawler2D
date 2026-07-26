import { describe, expect, it, vi } from "vitest";
import type { InputConnection } from "../../input/index.js";
import { Connection } from "../../net/connection.js";
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
] as const satisfies readonly (keyof InputConnection)[];

describe("production InputConnection adapter", () => {
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
