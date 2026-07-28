import { LEVEL, World } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { GameSim } from "../../core/index.js";
import {
  content,
  findFlatArena,
  makeSim,
  nearbyAreaTile,
  SEED,
  stepN,
  teleport,
} from "../support.js";

const PERSISTENT_HOTBAR_CLIENT = "persistent-hotbar";

/**
 * Pickup/stack/drop, explicit hotbar binding, and throwable regressions.
 * Positions are relative to the player's own body, but pickup gates on
 * same-level height (±1.5). A 0.5-tile offset can straddle a terrain step,
 * so pickup spots use `findFlatArena` to guarantee co-height placement.
 */

describe("GameSim: items and inventory", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("picks up, stacks, drops — pickups never touch the hotbar; binding is explicit", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena({ sim: sim, anchor: { x: 28, y: 28 }, clearance: 1 });
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });
    sim.getInventory(a.playerId)!.length = 0; // clear the starter kit for a clean slate
    sim.getHotbar(a.playerId)!.fill(null);
    sim.spawnItem({ defId: "rag", x: entity.body.x + 0.5, y: entity.body.y, qty: 2 });
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    const inv = sim.getInventory(a.playerId)!;
    expect(inv).toEqual([{ item: "rag", qty: 2 }]);

    sim.spawnItem({ defId: "rag", x: entity.body.x + 0.5, y: entity.body.y, qty: 3 });
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    expect(inv).toEqual([{ item: "rag", qty: 5 }]); // stacked, unlimited

    sim.queueAction(a.playerId, { type: "drop", item: "rag" });
    let snap = sim.step().get(a.playerId)!;
    expect(inv).toEqual([{ item: "rag", qty: 4 }]);
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "rag")).toBe(true);

    // Picking a bandage up does NOT touch the hotbar (bindings are the
    // player's own); binding explicitly via assign makes 1-9 use it.
    const arena2 = findFlatArena({ sim: sim, anchor: { x: arena.x + 40, y: arena.y + 40 }, clearance: 1 }); // clear of the rag we just dropped
    teleport({ entity: entity, x: arena2.x, y: arena2.y, sim: sim });
    entity.hp = 20;
    sim.effects.applyStatus({ entity, statusId: "bleeding", events: [] });
    sim.spawnItem({ defId: "bandage", x: entity.body.x + 0.5, y: entity.body.y, qty: 1 });
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    const hotbar = sim.getHotbar(a.playerId)!;
    expect(hotbar.indexOf("bandage")).toBe(-1); // never auto-bound
    sim.queueAction(a.playerId, { type: "assign", slot: 2, item: "bandage" });
    sim.step();
    expect(hotbar[2]).toBe("bandage");
    sim.queueAction(a.playerId, { type: "useSlot", slot: 2 });
    snap = sim.step().get(a.playerId)!;
    expect(snap.self.hp).toBe(24);
    expect(snap.self.fx).not.toContain("bleeding");
    expect(inv.find((s) => s.item === "bandage")).toBeUndefined(); // consumed
    expect(hotbar[2]).toBe("bandage"); // binding survives the empty stack
  });

  it("a thrown vodka bottle leaves an oil slick; a torch onto it ignites", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    // The throw travels 4 tiles: the whole flight path (not just the
    // player's own tile) has to be real, wall-free floor for the arc to
    // land where the test expects instead of stopping short at a wall.
    const arena = findFlatArena({ sim: sim, anchor: { x: entity.body.x, y: entity.body.y }, clearance: 4 });
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });
    const inv = sim.getInventory(a.playerId)!;
    const hotbar = sim.getHotbar(a.playerId)!;
    inv.push({ item: "vodka-bottle", qty: 1 });
    hotbar[0] = "vodka-bottle";
    const tx = entity.body.x + 4;
    const ty = entity.body.y;
    sim.queueAction(a.playerId, { type: "useSlot", slot: 0, targetX: tx, targetY: ty });
    stepN(sim, 30); // flight + impact
    const oilTile = nearbyAreaTile({ sim: sim, x: tx, y: ty, tag: "oil" });
    expect(oilTile).not.toBeNull();

    inv.push({ item: "torch", qty: 1 });
    hotbar[0] = "torch";
    sim.queueAction(a.playerId, { type: "useSlot", slot: 0, targetX: tx, targetY: ty });
    stepN(sim, 30);
    expect(nearbyAreaTile({ sim: sim, x: tx, y: ty, tag: "fire" })).not.toBeNull();
  });

  it("uses consumables directly while rejecting invalid equip and hotbar assignments", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    entity.hp = 20;
    sim.effects.applyStatus({ entity, statusId: "bleeding", events: [] });
    sim.queueAction(a.playerId, { type: "useItem", item: "bandage" });
    sim.step();
    expect(entity.hp).toBe(24);
    expect(entity.statuses.some((status) => status.defId === "bleeding")).toBe(false);
    expect(sim.getInventory(a.playerId)!.find((stack) => stack.item === "bandage")?.qty).toBe(1);

    sim.queueAction(a.playerId, { type: "equip", item: "torch" });
    sim.queueAction(a.playerId, { type: "assign", slot: 0, item: "sword" });
    sim.queueAction(a.playerId, { type: "assign", slot: 2, item: "torch" });
    sim.step();
    expect(sim.getWeapon(a.playerId)).toBe("sword");
    expect(sim.getHotbar(a.playerId)![0]).toBe("torch");
    expect(sim.getHotbar(a.playerId)![1]).toBe("bandage");
    expect(sim.getHotbar(a.playerId)![2]).toBe("torch");
  });

  it("restores queued hotbar assignment and unbind actions from the store", () => {
    const store = new PlayerStore(null);
    const createSim = (seed: number) =>
      new GameSim({ world: new World(SEED, 1, LEVEL.Sandbox), content: content, store: store, rngSeed: seed, opts: { testFixtures: true } }
      );
    const first = createSim(1);
    const joined = first.addPlayer({ name: "A", clientId: PERSISTENT_HOTBAR_CLIENT });
    first.queueAction(joined.playerId, {
      type: "assign",
      slot: 4,
      item: "torch",
    });
    first.step();

    const second = createSim(2);
    const rejoined = second.addPlayer({ name: "A", clientId: PERSISTENT_HOTBAR_CLIENT });
    expect(second.getHotbar(rejoined.playerId)?.[4]).toBe("torch");
    second.queueAction(rejoined.playerId, {
      type: "assign",
      slot: 0,
      item: null,
    });
    second.step();

    const third = createSim(3);
    const restored = third.addPlayer({ name: "A", clientId: PERSISTENT_HOTBAR_CLIENT });
    expect(third.getHotbar(restored.playerId)?.[0]).toBeNull();
    expect(third.getHotbar(restored.playerId)?.[4]).toBe("torch");
  });
});
