import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  LEVEL,
  buildContentRegistry,
  hashString,
  stairwayDownPosition,
  type ContentRegistry,
  type Entity,
} from "@dc2d/engine";
import { afterEach, describe, expect, it } from "vitest";
import { FloorRegistry } from "./floorRegistry.js";
import { PlayerStore } from "./store.js";

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});
const SEED = hashString("floor-persistence-test-world");
const files: string[] = [];

function tempFile(): string {
  const file = join(tmpdir(), `dc2d-floor-persistence-${Date.now()}-${Math.random()}.json`);
  files.push(file);
  return file;
}

function registry(store: PlayerStore): FloorRegistry {
  return new FloorRegistry(SEED, content, store, 1, {});
}

function place(entity: Entity, x: number, y: number): void {
  entity.body.x = x;
  entity.body.y = y;
  entity.body.grounded = true;
}

function descend(floors: FloorRegistry, token: string, playerId: string): void {
  const source = floors.findByToken(token)!;
  const stairs = stairwayDownPosition(source.world)!;
  place(source.getPlayerEntity(playerId)!, stairs.x, stairs.y);
  source.queueAction(playerId, { type: "descend" });
  floors.stepAll();
}

afterEach(() => {
  for (const file of files.splice(0)) rmSync(file, { force: true });
});

describe("durable descent lifecycle", () => {
  it("restores the active floor after process restart and resumes there in memory", () => {
    const file = tempFile();
    const firstStore = new PlayerStore(file);
    const firstFloors = registry(firstStore);
    const joined = firstFloors.base.addPlayer("A", "client-a");
    descend(firstFloors, joined.resumeToken, joined.playerId);
    descend(firstFloors, joined.resumeToken, joined.playerId);
    firstStore.flush();

    const secondStore = new PlayerStore(file);
    const secondFloors = registry(secondStore);
    const restoredFloor = secondFloors.joinSim("client-a");
    expect(restoredFloor.world.floor).toBe(3);
    const restored = restoredFloor.addPlayer("A", "client-a");
    restoredFloor.markDisconnected(restored.playerId);
    expect(restoredFloor.addPlayer("A", "client-a", restored.resumeToken)).toMatchObject({
      resumed: true,
      floor: 3,
    });
  });

  it("records floor 1 as soon as hard death begins, surviving a restart during the delay", () => {
    const file = tempFile();
    const firstStore = new PlayerStore(file);
    const firstFloors = registry(firstStore);
    const floor3 = firstFloors.ensureFloor(3);
    const joined = floor3.addPlayer("A", "client-a");
    floor3.getPlayerEntity(joined.playerId)!.hp = 0;
    firstFloors.stepAll();
    firstStore.flush();

    const secondStore = new PlayerStore(file);
    expect(secondStore.find("client-a")?.activeFloor).toBe(1);
    expect(registry(secondStore).joinSim("client-a").world.floor).toBe(1);
  });

  it("persists terminal completion once and keeps it through death/restart", () => {
    const file = tempFile();
    const firstStore = new PlayerStore(file);
    const player = firstStore.get("client-a", "A");
    firstStore.recordActiveFloor(player, 5);
    expect(firstStore.completeDescent(player)).toBe(true);
    expect(firstStore.completeDescent(player)).toBe(false);
    firstStore.recordActiveFloor(player, 1);
    firstStore.flush();

    const secondStore = new PlayerStore(file);
    expect(secondStore.find("client-a")).toMatchObject({
      activeFloor: 1,
      descentComplete: true,
    });
  });

  it("dissolves a party when one member descends so no party spans floor sims", () => {
    const floors = registry(new PlayerStore(null));
    const a = floors.base.addPlayer("A", "client-a");
    const b = floors.base.addPlayer("B", "client-b");
    const aEntity = floors.base.getPlayerEntity(a.playerId)!;
    const bEntity = floors.base.getPlayerEntity(b.playerId)!;
    place(aEntity, 10, 10);
    place(bEntity, 11, 10);
    floors.base.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    floors.stepAll();
    floors.base.queueAction(b.playerId, { type: "party", op: "accept" });
    expect(floors.stepAll().snapshots.get(a.playerId)?.party).not.toBeNull();

    descend(floors, a.resumeToken, a.playerId);
    const snapshots = floors.stepAll().snapshots;
    expect(snapshots.get(a.playerId)?.self.floor).toBe(2);
    expect(snapshots.get(a.playerId)?.party).toBeNull();
    expect(snapshots.get(b.playerId)?.party).toBeNull();
  });

  it("does not allow a new client to select a deeper floor", () => {
    const floors = registry(new PlayerStore(null));
    expect(floors.joinSim("unknown-client").world.level).toBe(LEVEL.Dungeon);
    expect(floors.joinSim("unknown-client").world.floor).toBe(1);
  });
});
