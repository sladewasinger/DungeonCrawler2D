import { LEVEL, World, safeRoomSpawn, spawnRoomSpawn } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { findSpawn } from "../spawn/spawn.js";
import { createSimState } from "../state/state.js";
import { SEED, content } from "../integration/support.js";
import { despawnAdminEntity, spawnAdminEntity } from "./adminSpawning.js";

describe("admin entity placement", () => {
  it("normalizes every accepted spawn to the selected tile centre", () => {
    const sim = adminTestState();
    const spawn = findSpawn(sim);
    const result = spawnAdminEntity(sim, {
      op: "spawn",
      level: "sandbox",
      floor: 1,
      kind: "enemy",
      defId: "slime",
      x: Math.floor(spawn.x) + 0.07,
      y: Math.floor(spawn.y) + 0.91,
    });
    const enemy = [...sim.enemies.values()][0]?.entity;

    expect(result.ok).toBe(true);
    expect(enemy?.body).toMatchObject({
      x: Math.floor(spawn.x) + 0.5,
      y: Math.floor(spawn.y) + 0.5,
    });
  });

  it("removes weapons and rejects other ground items", () => {
    const sim = adminTestState();
    const spawn = findSpawn(sim);
    const weapon = spawnAdminEntity(sim, spawnCommand("weapon", "sword", spawn));
    const weaponId = [...sim.items.keys()][0]!;
    const plainItem = spawnAdminEntity(sim, spawnCommand("item", "rag", spawn));
    const itemId = [...sim.items.keys()].find((id) => id !== weaponId)!;

    expect(weapon.ok).toBe(true);
    expect(plainItem.ok).toBe(true);
    expect(despawnAdminEntity(sim, despawnCommand(weaponId)).ok).toBe(true);
    expect(despawnAdminEntity(sim, despawnCommand(itemId))).toMatchObject({
      ok: false,
      code: "entity_not_removable",
    });
  });

  it("removes an enemy selected from the map marker", () => {
    const sim = adminTestState();
    const point = findSpawn(sim);
    const result = spawnAdminEntity(sim, {
      op: "spawn",
      level: "sandbox",
      floor: 1,
      kind: "enemy",
      defId: "slime",
      x: point.x,
      y: point.y,
    });
    const enemyId = [...sim.enemies.keys()][0]!;

    expect(result.ok).toBe(true);
    expect(despawnAdminEntity(sim, despawnCommand(enemyId)).ok).toBe(true);
    expect(sim.enemies.size).toBe(0);
  });

  it.each([
    ["spawn", spawnRoomSpawn(0)],
    ["safe", safeRoomSpawn(4, 7)],
  ] as const)("does not place enemies in the protected %s room", (_kind, point) => {
    const sim = adminDungeonState();

    expect(spawnAdminEntity(sim, {
      op: "spawn",
      level: LEVEL.Dungeon,
      floor: 1,
      kind: "enemy",
      defId: "goblin",
      x: point.x,
      y: point.y,
    })).toEqual({ ok: false, code: "invalid_spawn_location" });
    expect(sim.enemies.size).toBe(0);
  });

});

function adminTestState() {
  return createSimState({
    world: new World(SEED, 1, LEVEL.Sandbox),
    content,
    store: new PlayerStore(null),
    rngSeed: 1,
    opts: {},
  });
}

function adminDungeonState() {
  return createSimState({
    world: new World(SEED, 1, {
      level: LEVEL.Dungeon,
      features: { voidTerrain: false },
    }),
    content,
    store: new PlayerStore(null),
    rngSeed: 1,
    opts: {},
  });
}

function spawnCommand(
  kind: "item" | "weapon",
  defId: string,
  point: { readonly x: number; readonly y: number },
) {
  return {
    op: "spawn" as const,
    level: "sandbox" as const,
    floor: 1,
    kind,
    defId,
    x: point.x,
    y: point.y,
  };
}

function despawnCommand(entityId: string) {
  return { op: "despawn" as const, level: "sandbox" as const, floor: 1, entityId };
}
