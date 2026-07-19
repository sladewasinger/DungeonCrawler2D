import { beforeEach, describe, expect, it } from "vitest";
import type { GameSim } from "../index.js";
import { findFlatArena, makeSim, nearbyAreaTile, stepN, teleport } from "./support.js";

/**
 * Epic 4 regressions: pickup/stack/drop, explicit hotbar binding, and
 * throwables — ported from reference/game-server/sim.test.ts. Positions
 * are relative to the player's own body, but pickup gates on same-level
 * height (±1.5) — on the BSP overworld a 0.5-tile offset can straddle a
 * terrain step, so pickup spots use `findFlatArena` to guarantee the
 * item lands at the player's own height, unlike v1's hand-flattened
 * sandbox chunk where any nearby offset was safely co-height.
 */

describe("GameSim: items and inventory", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("picks up, stacks, drops — pickups never touch the hotbar; binding is explicit", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena(sim, 28, 28, 1);
    teleport(entity, arena.x, arena.y, sim);
    sim.spawnItem("rag", entity.body.x + 0.5, entity.body.y, 2);
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    const inv = sim.getInventory(a.playerId)!;
    expect(inv).toEqual([{ item: "rag", qty: 2 }]);

    sim.spawnItem("rag", entity.body.x + 0.5, entity.body.y, 3);
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    expect(inv).toEqual([{ item: "rag", qty: 5 }]); // stacked, unlimited

    sim.queueAction(a.playerId, { type: "drop", item: "rag" });
    let snap = sim.step().get(a.playerId)!;
    expect(inv.length).toBe(0);
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "rag")).toBe(true);

    // Picking a bandage up does NOT touch the hotbar (bindings are the
    // player's own); binding explicitly via assign makes 1-9 use it.
    const arena2 = findFlatArena(sim, arena.x + 40, arena.y + 40, 1); // clear of the rag we just dropped
    teleport(entity, arena2.x, arena2.y, sim);
    entity.hp = 20;
    sim.effects.applyStatus(entity, "bleeding", []);
    sim.spawnItem("bandage", entity.body.x + 0.5, entity.body.y, 1);
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
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const inv = sim.getInventory(a.playerId)!;
    const hotbar = sim.getHotbar(a.playerId)!;
    inv.push({ item: "vodka-bottle", qty: 1 });
    hotbar[0] = "vodka-bottle";
    const tx = entity.body.x + 4;
    const ty = entity.body.y;
    sim.queueAction(a.playerId, { type: "useSlot", slot: 0, targetX: tx, targetY: ty });
    stepN(sim, 30); // flight + impact
    const oilTile = nearbyAreaTile(sim, tx, ty, "oil");
    expect(oilTile).not.toBeNull();

    inv.push({ item: "torch", qty: 1 });
    hotbar[0] = "torch";
    sim.queueAction(a.playerId, { type: "useSlot", slot: 0, targetX: tx, targetY: ty });
    stepN(sim, 30);
    expect(nearbyAreaTile(sim, tx, ty, "fire")).not.toBeNull();
  });
});
