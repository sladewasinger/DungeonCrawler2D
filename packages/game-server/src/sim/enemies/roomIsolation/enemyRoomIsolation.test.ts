import {
  CHUNK_SIZE,
  LEVEL,
  ROOM_REGION_CY,
  safeRoomSpawn,
  spawnRoomSpawn,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { spawnAdminEntity } from "../../admin/adminSpawning.js";
import { spawnEnemy } from "../../core/helpers.js";
import { content } from "../../integration/support.js";
import { addPlayer } from "../../players/join.js";
import { createSimState, type SimState } from "../../state/state.js";
import { stepEnemies } from "../ai.js";
import { moveEnemy } from "../ai/enemyMovement.js";
import { activateChunksNearPlayers } from "../population.js";
import { validEnemySpawn } from "../populationPlacement.js";
import { finiteServerWorldFixture } from "../../testing/finiteWorldTestSupport.js";

describe("enemy isolation from protected rooms", () => {
  it.each([
    ["spawn", spawnRoomSpawn(0)],
    ["safe", safeRoomSpawn(3, -2)],
  ] as const)("rejects direct and ambient enemy spawns in the %s room", (_kind, point) => {
    const sim = isolationState();

    expect(validEnemySpawn(sim, point.x, point.y)).toBe(false);
    expect(() => spawnEnemy(sim, {
      defId: "goblin",
      x: point.x,
      y: point.y,
    })).toThrow(/protected room/);
    expect(sim.enemies.size).toBe(0);
  });

  it.each([
    ["spawn", spawnRoomSpawn(0)],
    ["safe", safeRoomSpawn(3, -2)],
  ] as const)("rejects admin enemy placement in the %s room", (_kind, point) => {
    const sim = isolationState();
    const result = spawnAdminEntity(sim, {
      op: "spawn",
      level: LEVEL.Dungeon,
      floor: 1,
      kind: "enemy",
      defId: "goblin",
      x: point.x,
      y: point.y,
    });

    expect(result).toEqual({ ok: false, code: "invalid_spawn_location" });
    expect(sim.enemies.size).toBe(0);
  });

  it("removes a hostile moved into protected room space before it can act", () => {
    const sim = isolationState();
    const point = ordinaryEnemyPoint(sim);
    const entity = spawnEnemy(sim, { defId: "goblin", ...point });
    Object.assign(entity.body, spawnRoomSpawn(0));

    stepEnemies(sim, []);

    expect(sim.enemies.has(entity.id)).toBe(false);
    expect(sim.replicationMotion.has(entity.id)).toBe(false);
  });

  it("does not populate around a player waiting in the spawn room", () => {
    const sim = isolationState();
    const join = addPlayer(sim, { name: "Waiting", clientId: "spawn-waiting" });
    expect(Math.floor(join.spawn.y / CHUNK_SIZE))
      .toBeGreaterThanOrEqual(ROOM_REGION_CY);
    expect(sim.enemies.size).toBe(0);

    activateChunksNearPlayers(sim);

    expect(sim.enemies.size).toBe(0);
  });

  it("blocks enemy movement inside protected room space", () => {
    const sim = isolationState();
    const point = ordinaryEnemyPoint(sim);
    const entity = spawnEnemy(sim, { defId: "goblin", ...point });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing enemy isolation fixture");
    Object.assign(entity.body, spawnRoomSpawn(0));
    const before = { x: entity.body.x, y: entity.body.y };

    moveEnemy({
      sim,
      enemy,
      move: { moveX: 1, moveY: 0, jump: false },
      graced: [],
    });

    expect(entity.body).toMatchObject(before);
  });
});

function isolationState(): SimState {
  return createSimState({
    world: finiteServerWorldFixture(),
    content,
    store: new PlayerStore(null),
    rngSeed: 1,
    opts: {},
  });
}

function ordinaryEnemyPoint(sim: SimState): { readonly x: number; readonly y: number } {
  const rooms = sim.world.generatedFloor?.rooms ?? [];
  for (const room of rooms) {
    const point = { x: room.center.x + 0.5, y: room.center.y + 0.5 };
    if (validEnemySpawn(sim, point.x, point.y)) return point;
  }
  throw new Error("finite fixture has no ordinary enemy room position");
}
