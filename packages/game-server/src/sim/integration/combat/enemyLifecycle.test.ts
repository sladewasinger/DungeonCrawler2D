import { PLAYER_MAX_HP, TICK_RATE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { DEATH_TO_RESPAWN_TICKS } from "../../deathTestSupport.js";
import { findFlatArena, makeSim, stepN, teleport } from "../support.js";

describe("GameSim: enemy lifecycle", () => {
  it("enemies chase and hurt players; kills drop loot and respawn far away", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "A", clientId: "client-a" });
    sim.endSpawnGrace(player.playerId);
    const entity = sim.getPlayerEntity(player.playerId)!;
    const arena = findFlatArena({ sim, anchor: { x: 28, y: 28 }, clearance: 3 });
    teleport({ entity, x: arena.x, y: arena.y, sim });
    sim.spawnEnemy("skeleton", entity.body.x + 3, entity.body.y);
    stepN(sim, TICK_RATE * 4);
    expect(entity.hp).toBeLessThan(PLAYER_MAX_HP);

    sim.getInventory(player.playerId)!.push({ item: "torch", qty: 2 });
    const deathX = entity.body.x;
    entity.hp = 0;
    sim.step();
    const snapshot = stepN(sim, DEATH_TO_RESPAWN_TICKS + 2).get(player.playerId)!;
    expect(snapshot.self.hp).toBe(PLAYER_MAX_HP);
    expectStarterKit(sim, player.playerId);
    expect(Math.abs(snapshot.self.x - deathX)).toBeGreaterThan(1);
  });

  it("dead enemies roll their drop table", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const arena = findFlatArena({ sim, anchor: { x: 28, y: 28 } });
    teleport({ entity, x: arena.x, y: arena.y, sim });
    for (let index = 0; index < 3; index++) {
      const plant = sim.spawnEnemy("plant-creeper", entity.body.x + 2 + index, entity.body.y);
      plant.hp = 0;
    }
    const snapshot = sim.step().get(player.playerId)!;
    expect(snapshot.entities.some((entry) => entry.kind === "item" && entry.defId === "stick")).toBe(true);
  });
});

function expectStarterKit(sim: ReturnType<typeof makeSim>, playerId: string): void {
  const inventory = sim.getInventory(playerId)!;
  expect(inventory.find((slot) => slot.item === "sword")?.qty).toBe(1);
  expect(inventory.find((slot) => slot.item === "torch")?.qty).toBe(3);
  expect(inventory.find((slot) => slot.item === "bandage")?.qty).toBe(2);
  expect(inventory).toHaveLength(3);
  expect(sim.getWeapon(playerId)).toBe("sword");
}
