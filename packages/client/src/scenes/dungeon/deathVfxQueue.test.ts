import {
  LEVEL,
  World,
  createBody,
  type ServerSnapshot,
} from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { applySnapshot } from "../../net/apply.js";
import { Connection } from "../../net/connection.js";
import type { VfxSystem } from "../../vfx/index.js";
import { syncDamageVfx } from "./damageVfxTracking.js";

function deathSnapshot(): ServerSnapshot {
  return {
    type: "snapshot",
    tick: 2,
    lastSeq: 0,
    lastProjectedServerTick: 0,
    self: {
      x: 1, y: 2, z: 0, zVel: 0, grounded: true,
      coyoteTime: 0, jumpBuffer: 0, jumpHeld: false,
      kx: 0, ky: 0, hp: 30, maxHp: 30, fx: [],
    },
    inventory: [],
    hotbar: [],
    weapon: "sword",
    party: null,
    entities: [],
    left: ["enemy-1"],
    events: [{ t: "death", id: "enemy-1" }],
    areas: [],
  };
}

describe("live enemy death VFX queue", () => {
  it("retains the removed enemy and triggers gore after snapshot pruning", () => {
    const connection = new Connection(
      "wss://example.test", "Crawler", "client-1",
    );
    connection.world = new World(123, 1, LEVEL.Dungeon);
    connection.body = createBody(1, 2, 0);
    connection.welcome = {
      type: "welcome",
      protocol: 1,
      playerId: "player-1",
      resumeToken: "token",
      worldSeed: 123,
      floor: 1,
      level: LEVEL.Dungeon,
      tickRate: 20,
      spawn: { x: 1, y: 2, z: 0 },
    };
    connection.hp = 30;
    connection.maxHp = 30;
    connection.hasReceivedSnapshot = true;
    connection.entities.set("enemy-1", {
      snap: {
        id: "enemy-1",
        kind: "enemy",
        defId: "slime",
        x: 5,
        y: 6,
        z: 1,
        hp: 0,
        maxHp: 8,
      },
      samples: [{ t: 0, x: 5, y: 6, z: 1 }],
    });

    applySnapshot(connection, deathSnapshot());
    expect(connection.entities.has("enemy-1")).toBe(false);

    const spawnBloodDeath = vi.fn();
    const spawnKillMoment = vi.fn();
    const vfx = {
      setSelfHp: vi.fn(),
      spawnBloodDeath,
      spawnKillMoment,
    } as unknown as VfxSystem;
    syncDamageVfx(
      new Map(),
      new Set(),
      connection.world,
      vfx,
      [],
      [],
      new Map(),
      "player-1",
      { x: 0, y: 0 },
      100,
      connection.drainDeathVisualEvents(),
    );

    const groundHeight = connection.world.groundAt(5, 6);
    expect(spawnBloodDeath).toHaveBeenCalledWith(
      5, 6, groundHeight, "slime", 100,
    );
    expect(spawnKillMoment).toHaveBeenCalledWith(
      5,
      6,
      groundHeight,
      "slime",
      100,
      { targetKind: "enemy" },
      undefined,
      undefined,
    );
  });
});
