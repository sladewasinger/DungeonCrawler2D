import { type Entity, type World } from "@dc2d/engine";
import { afterEach, describe, expect, it } from "vitest";
import { FloorRegistry } from "./floorRegistry.js";
import { DEATH_TO_RESPAWN_TICKS } from "../sim/combat/deathTestSupport.js";
import { PlayerStore } from "../store.js";
import { createFloorRegistryFixture, disposeFloorRegistryFixture } from "./floorRegistryTestSupport.js";
/** Integration coverage for real FloorRegistry descent and cross-floor state. */
const CHAT_EVENT = "chat";
const HELLO_FLOOR = "hello floor";
const registries: FloorRegistry[] = [];
function makeRegistry(
  floors: readonly number[],
  store = new PlayerStore(null),
): FloorRegistry {
  const registry = createFloorRegistryFixture({ floors, store });
  registries.push(registry);
  return registry;
}
afterEach(async () => Promise.all(
  registries.splice(0).map(disposeFloorRegistryFixture),
));
function placeAt(
  entity: Entity,
  position: { readonly x: number; readonly y: number },
  world: Pick<World, "groundAt">,
): void {
  entity.body.x = position.x;
  entity.body.y = position.y;
  entity.body.z = world.groundAt(position.x, position.y);
  entity.body.fallStart = entity.body.z;
  entity.body.grounded = true;
}
describe("FloorRegistry: the descent chain", () => {
  it("walks 1 -> 5 via real descend intents, arriving at each up-stair, deepestFloor tracked", { timeout: 45_000 }, async () => {
    const floors = makeRegistry([1, 2, 3, 4, 5]);
    const join = floors.base.addPlayer({ name: "A", clientId: "client-a" });
    expect(join.floor).toBe(1);
    const entity = floors.base.getPlayerEntity(join.playerId)!;
    for (let floor = 1; floor < 5; floor++) {
      const sim = floors.findByToken(join.resumeToken)!;
      const down = sim.world.downStairwayPositions()[0]!;
      expect(down).toBeTruthy();
      placeAt(entity, down, sim.world);
      expect(sim.world.floor).toBe(floor);
      sim.queueAction(join.playerId, { type: "descend" });
      const firstTick = floors.stepAll();
      expect(firstTick.moved).toHaveLength(0);
      await floors.waitForPendingFloorPreparations();
      const { moved } = floors.stepAll();
      expect(moved.some((m) => m.playerId === join.playerId && m.sim.world.floor === floor + 1)).toBe(true);
    }
    const finalSim = floors.findByToken(join.resumeToken)!;
    expect(finalSim.world.floor).toBe(5);
    const snap = finalSim.step().get(join.playerId)!;
    expect(snap.self.floor).toBe(5);
    expect(snap.self.deepestFloor).toBe(5);
  });
  it("does not accept a descend intent at an arrival stairway", async () => {
    const floors = makeRegistry([1, 2]);
    const join = floors.base.addPlayer({ name: "A", clientId: "client-a" });
    const entity = floors.base.getPlayerEntity(join.playerId)!;
    const down = floors.base.world.downStairwayPositions()[0]!;
    placeAt(entity, down, floors.base.world);
    floors.base.queueAction(join.playerId, { type: "descend" });
    floors.stepAll();
    await floors.waitForPendingFloorPreparations();
    floors.stepAll();
    const floor2 = floors.findByToken(join.resumeToken)!;
    const arrival = floor2.world.upStairwayPosition()!;
    placeAt(entity, arrival, floor2.world);
    floor2.queueAction(join.playerId, { type: "descend" });
    const result = floors.stepAll();

    expect(result.moved.some((move) => move.playerId === join.playerId)).toBe(false);
    expect(floors.findByToken(join.resumeToken)?.world.floor).toBe(2);
    expect(result.snapshots.get(join.playerId)?.events).toContainEqual({
      t: "toast",
      msg: "No stairway in reach.",
    });
  });
  it("enemy stats scale on a live floor-3 sim (floor 1 stays unscaled)", () => {
    const floors = makeRegistry([1, 3]);
    const floor1Slime = floors.base.spawnEnemy("slime", 5, 5);
    const floor3Slime = floors.ensureFloor(3).spawnEnemy("slime", 5, 5);
    expect(floor1Slime.hp).toBe(12); // unscaled
    expect(floor3Slime.hp).toBeCloseTo(12 * 1.35 * 1.35);
  });
  it("death on floor 3 returns the player to floor 1, loot stays on floor 3", () => {
    const floors = makeRegistry([1, 3]);
    const sim3 = floors.ensureFloor(3);
    const join = sim3.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim3.getPlayerEntity(join.playerId)!;
    const chestsBefore = sim3.lootChestCount;
    entity.hp = 0;
    for (let i = 0; i < DEATH_TO_RESPAWN_TICKS + 2; i++) floors.stepAll();
    expect(sim3.lootChestCount).toBeGreaterThan(chestsBefore); // starter kit stays in its death chest
    expect(sim3.playerCount).toBe(0); // no longer resident on floor 3
    const home = floors.findByToken(join.resumeToken)!;
    expect(home.world.floor).toBe(1);
    expect(home.getPlayerEntity(join.playerId)!.hp).toBeGreaterThan(0);
  });
  it("global chat relays across floors with the store's registry, one tick of delay", () => {
    const floors = makeRegistry([1, 4]);
    const onFloor1 = floors.base.addPlayer({ name: "A", clientId: "client-a" });
    const onFloor4 = floors.ensureFloor(4).addPlayer({ name: "B", clientId: "client-b" });
    floors.base.queueAction(onFloor1.playerId, { type: CHAT_EVENT, channel: "global", text: HELLO_FLOOR });
    const first = floors.stepAll().snapshots.get(onFloor4.playerId)!;
    expect(first.events.some((e) => e.t === CHAT_EVENT && e.text === HELLO_FLOOR)).toBe(false);
    const second = floors.stepAll().snapshots.get(onFloor4.playerId)!;
    expect(second.events.some((e) => e.t === CHAT_EVENT && e.channel === "global" && e.text === HELLO_FLOOR)).toBe(
      true,
    );
  });
  it("applies durable mute controls to cross-floor global chat", () => {
    const floors = makeRegistry([1, 4]);
    const onFloor1 = floors.base.addPlayer({ name: "A", clientId: "client-a" });
    const floor4 = floors.ensureFloor(4);
    const onFloor4 = floor4.addPlayer({ name: "B", clientId: "client-b" });
    floor4.queueAction(onFloor4.playerId, {
      type: "moderation",
      op: "mute",
      target: "A",
    });
    floors.stepAll();

    floors.base.queueAction(onFloor1.playerId, {
      type: "chat",
      channel: "global",
      text: "blocked across floors",
    });
    floors.stepAll();
    const received = floors.stepAll().snapshots.get(onFloor4.playerId)?.events ?? [];
    expect(received.some(
      (event) => event.t === "chat" && event.text === "blocked across floors",
    )).toBe(false);
  });
  it("/who lists players across every active floor with their floor number", () => {
    const floors = makeRegistry([1, 2]);
    const onFloor1 = floors.base.addPlayer({ name: "A", clientId: "client-a" });
    floors.ensureFloor(2).addPlayer({ name: "B", clientId: "client-b" });
    floors.stepAll();

    floors.base.queueAction(onFloor1.playerId, { type: "who" });
    const snap = floors.stepAll().snapshots.get(onFloor1.playerId)!;
    const line = snap.events.find((event) => event.t === "chat" && event.channel === "system" && event.text.includes("Online"));
    expect(line).toMatchObject({ text: expect.stringContaining("A (F1)") });
    expect(line).toMatchObject({ text: expect.stringContaining("B (F2)") });
  });
});
