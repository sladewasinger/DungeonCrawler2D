import { LEVEL, World, personalRoomFeatures } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { GameSim } from "../../core/index.js";
import { SEED, content, eventsOf, makeSim, teleport } from "../support.js";

describe("GameSim: crafting and stash", () => {
  it("crafting needs the table and the ingredients", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const inventory = sim.getInventory(player.playerId)!;
    inventory.length = 0;
    inventory.push({ item: "rag", qty: 2 });

    sim.queueAction(player.playerId, { type: "craft", recipe: "bandage" });
    sim.step();
    expect(inventory.some((slot) => slot?.item === "bandage")).toBe(false);

    const features = personalRoomFeatures(0);
    teleport({ entity, x: features.table.x - 0.5, y: features.table.y + 0.5, sim });
    sim.queueAction(player.playerId, { type: "craft", recipe: "bandage" });
    sim.step();
    expect(inventory.some((slot) => slot?.item === "bandage")).toBe(true);
    expect(inventory.some((slot) => slot?.item === "rag")).toBe(false);
  });

  it("stash persists across sims (server restarts) via the store", () => {
    const store = new PlayerStore(null);
    const first = createPersistentSim(store, 1234);
    const player = first.addPlayer({ name: "A", clientId: "client-a" });
    const features = personalRoomFeatures(0);
    teleport({ entity: first.getPlayerEntity(player.playerId)!, x: features.stash.x + 1.5, y: features.stash.y + 0.5, sim: first });
    first.getInventory(player.playerId)![0] = { item: "knife", qty: 1 };
    first.queueAction(player.playerId, { type: "stash", op: "put", index: 0 });
    expect(stashSlots(first, player.playerId)).toEqual([{ item: "knife", qty: 1 }]);

    const resumed = createPersistentSim(store, 99);
    const rejoined = resumed.addPlayer({ name: "A", clientId: "client-a" });
    expect(resumed.getInventory(rejoined.playerId)?.find((slot) => slot.item === "sword")?.qty).toBe(1);
    teleport({ entity: resumed.getPlayerEntity(rejoined.playerId)!, x: features.stash.x + 1.5, y: features.stash.y + 0.5, sim: resumed });
    resumed.queueAction(rejoined.playerId, { type: "stash", op: "take", index: 0 });
    resumed.step();
    expect(resumed.getInventory(rejoined.playerId)?.find((slot) => slot.item === "knife")).toEqual({ item: "knife", qty: 1 });
  });
});

function createPersistentSim(store: PlayerStore, seed: number): GameSim {
  return new GameSim({ world: new World(SEED, 1, LEVEL.Sandbox), content: content, store: store, rngSeed: seed, opts: {} });
}

function stashSlots(sim: GameSim, playerId: string): unknown[] {
  const event = eventsOf(sim.step(), playerId).find((entry) => entry.t === "stash");
  return event && event.t === "stash" ? event.slots : [];
}
