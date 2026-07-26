import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  buildContentRegistry,
  hashString,
  stairwayDownPosition,
  stairwayUpPosition,
  type ContentRegistry,
  type Entity,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { FloorRegistry } from "./floorRegistry.js";
import { DEATH_TO_RESPAWN_TICKS } from "./sim/deathTestSupport.js";
import { PlayerStore } from "./store.js";

/**
 * Integration coverage for Epic 7.14 (The Descent) at the FloorRegistry
 * level: real GameSim instances, driven by real intents where the DoD
 * calls for it (the descent chain), direct SimState mutation only where
 * a mechanic (death) needs a fast-forward past its own timers. Boss
 * seal/unseal/respawn has its own focused suite (sim/floors/boss.test.ts);
 * protocol-mismatch rejection is server/dispatch's existing coverage
 * (server.test.ts), unaffected by this epic.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});
const SEED = hashString("floor-registry-test-world");

function makeRegistry(store = new PlayerStore(null)): FloorRegistry {
  return new FloorRegistry(SEED, content, store, 1, {});
}

function placeAt(entity: Entity, x: number, y: number): void {
  entity.body.x = x;
  entity.body.y = y;
  entity.body.grounded = true;
}

describe("FloorRegistry: the descent chain", () => {
  it("walks 1 -> 5 via real descend intents, arriving at each up-stair, deepestFloor tracked", () => {
    const floors = makeRegistry();
    const join = floors.base.addPlayer("A", "client-a");
    expect(join.floor).toBe(1);
    const entity = floors.base.getPlayerEntity(join.playerId)!;

    for (let floor = 1; floor < 5; floor++) {
      const down = stairwayDownPosition({ worldSeed: SEED, floor })!;
      expect(down).toBeTruthy();
      placeAt(entity, down.x, down.y);
      const sim = floors.findByToken(join.resumeToken)!;
      expect(sim.world.floor).toBe(floor);
      sim.queueAction(join.playerId, { type: "descend" });
      const { moved } = floors.stepAll();
      expect(moved.some((m) => m.playerId === join.playerId && m.sim.world.floor === floor + 1)).toBe(
        true,
      );
    }

    const finalSim = floors.findByToken(join.resumeToken)!;
    expect(finalSim.world.floor).toBe(5);
    const snap = finalSim.step().get(join.playerId)!;
    expect(snap.self.floor).toBe(5);
    expect(snap.self.deepestFloor).toBe(5);
  });

  it("does not accept a descend intent at an arrival stairway", () => {
    const floors = makeRegistry();
    const join = floors.base.addPlayer("A", "client-a");
    const entity = floors.base.getPlayerEntity(join.playerId)!;
    const down = stairwayDownPosition({ worldSeed: SEED, floor: 1 })!;
    placeAt(entity, down.x, down.y);
    floors.base.queueAction(join.playerId, { type: "descend" });
    floors.stepAll();

    const floor2 = floors.findByToken(join.resumeToken)!;
    const arrival = stairwayUpPosition(floor2.world)!;
    placeAt(entity, arrival.x, arrival.y);
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
    const floors = makeRegistry();
    const floor1Slime = floors.base.spawnEnemy("slime", 5, 5);
    const floor3Slime = floors.ensureFloor(3).spawnEnemy("slime", 5, 5);
    expect(floor1Slime.hp).toBe(12); // unscaled
    expect(floor3Slime.hp).toBeCloseTo(12 * 1.35 * 1.35);
  });

  it("death on floor 3 returns the player to floor 1, loot stays on floor 3", () => {
    const floors = makeRegistry();
    const sim3 = floors.ensureFloor(3);
    const join = sim3.addPlayer("A", "client-a");
    const entity = sim3.getPlayerEntity(join.playerId)!;
    const itemsBefore = sim3.itemCount;

    entity.hp = 0;
    for (let i = 0; i < DEATH_TO_RESPAWN_TICKS + 2; i++) floors.stepAll();

    expect(sim3.itemCount).toBeGreaterThan(itemsBefore); // starter kit dropped where they died
    expect(sim3.playerCount).toBe(0); // no longer resident on floor 3
    const home = floors.findByToken(join.resumeToken)!;
    expect(home.world.floor).toBe(1);
    expect(home.getPlayerEntity(join.playerId)!.hp).toBeGreaterThan(0);
  });

  it("global chat relays across floors with the store's registry, one tick of delay", () => {
    const floors = makeRegistry();
    const onFloor1 = floors.base.addPlayer("A", "client-a");
    const onFloor4 = floors.ensureFloor(4).addPlayer("B", "client-b");

    floors.base.queueAction(onFloor1.playerId, { type: "chat", channel: "global", text: "hello floor" });
    const first = floors.stepAll().snapshots.get(onFloor4.playerId)!;
    expect(first.events.some((e) => e.t === "chat" && e.text === "hello floor")).toBe(false);

    const second = floors.stepAll().snapshots.get(onFloor4.playerId)!;
    expect(second.events.some((e) => e.t === "chat" && e.channel === "global" && e.text === "hello floor")).toBe(
      true,
    );
  });

  it("applies durable mute controls to cross-floor global chat", () => {
    const floors = makeRegistry();
    const onFloor1 = floors.base.addPlayer("A", "client-a");
    const floor4 = floors.ensureFloor(4);
    const onFloor4 = floor4.addPlayer("B", "client-b");
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
    const floors = makeRegistry();
    const onFloor1 = floors.base.addPlayer("A", "client-a");
    floors.ensureFloor(2).addPlayer("B", "client-b");
    floors.stepAll(); // let the cross-floor directory settle (refreshed at the tail of stepAll)

    floors.base.queueAction(onFloor1.playerId, { type: "who" });
    const snap = floors.stepAll().snapshots.get(onFloor1.playerId)!;
    const line = snap.events.find((e) => e.t === "chat" && e.channel === "system" && e.text.includes("Online"));
    expect(line).toMatchObject({ text: expect.stringContaining("A (F1)") });
    expect(line).toMatchObject({ text: expect.stringContaining("B (F2)") });
  });
});
