import type { ServerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "./connection.js";
import { applyEvent } from "./applyEvents.js";
import {
  captureCombatHealth,
  inferMissingDamageEvents,
} from "./combatEventInference.js";

function snapshotWithEnemy(
  hp: number,
  events: ServerSnapshot["events"] = [],
): ServerSnapshot {
  return {
    type: "snapshot",
    tick: 2,
    lastSeq: 0,
    lastProjectedServerTick: 0,
    self: {
      x: 1, y: 2, z: 0, zVel: 0, grounded: true,
      coyoteTime: 0, jumpBuffer: 0, jumpHeld: false, kx: 0, ky: 0,
      hp: 30, maxHp: 30, fx: [],
    },
    inventory: [],
    hotbar: [],
    weapon: null,
    party: null,
    entities: [{
      id: "enemy-1",
      kind: "enemy",
      defId: "slime",
      x: 5,
      y: 6,
      z: 0,
      hp,
      maxHp: 12,
      fx: [],
    }],
    left: [],
    events,
    areas: [],
  };
}

describe("combat visual event capture", () => {
  it("preserves a dead enemy's final render target before snapshot pruning", () => {
    const connection = {
      welcome: { playerId: "player-1" },
      body: { x: 1, y: 2 },
      entities: new Map([["enemy-1", {
        snap: {
          id: "enemy-1",
          kind: "enemy",
          defId: "slime",
          x: 5,
          y: 6,
          z: 0,
        },
      }]]),
      visualEvents: [],
      deathVisualEvents: [],
    } as unknown as Connection;

    applyEvent(connection, { t: "death", id: "enemy-1" });
    connection.entities.delete("enemy-1");

    expect(connection.deathVisualEvents).toContainEqual({
      t: "death",
      id: "enemy-1",
      x: 5,
      y: 6,
      defId: "slime",
      targetKind: "enemy",
    });
  });

  it("infers missing damage from authoritative remote HP without duplicating it", () => {
    const connection = {
      welcome: { playerId: "player-1" },
      body: { x: 1, y: 2 },
      hp: 30,
      hasReceivedSnapshot: true,
      entities: new Map([["enemy-1", {
        snap: snapshotWithEnemy(12).entities[0],
      }]]),
      visualEvents: [],
      deathVisualEvents: [],
    } as unknown as Connection;
    const before = captureCombatHealth(connection);

    inferMissingDamageEvents(connection, snapshotWithEnemy(8), before);

    expect(connection.visualEvents).toContainEqual({
      t: "health",
      id: "enemy-1",
      delta: -4,
      kind: "damage",
      x: 5,
      y: 6,
      defId: "slime",
      targetKind: "enemy",
    });
    expect(connection.visualEvents).toContainEqual({
      t: "damageImpact",
      id: "enemy-1",
      amount: 4,
      x: 5,
      y: 6,
      defId: "slime",
      targetKind: "enemy",
    });
  });

  it("fills only the missing impact when an old server carries health alone", () => {
    const connection = {
      welcome: { playerId: "player-1" },
      body: { x: 1, y: 2 },
      hp: 30,
      hasReceivedSnapshot: true,
      entities: new Map([["enemy-1", {
        snap: snapshotWithEnemy(12).entities[0],
      }]]),
      visualEvents: [],
    } as unknown as Connection;
    const before = captureCombatHealth(connection);

    inferMissingDamageEvents(
      connection,
      snapshotWithEnemy(8, [{
        t: "health",
        id: "enemy-1",
        delta: -4,
        kind: "damage",
      }]),
      before,
    );

    expect(connection.visualEvents).toEqual([{
      t: "damageImpact",
      id: "enemy-1",
      amount: 4,
      x: 5,
      y: 6,
      defId: "slime",
      targetKind: "enemy",
    }]);
  });
});
