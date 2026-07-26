import { describe, expect, it } from "vitest";
import type { Connection } from "./connection.js";
import { applyEvent } from "./applyEvents.js";

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
    } as unknown as Connection;

    applyEvent(connection, { t: "death", id: "enemy-1" });
    connection.entities.delete("enemy-1");

    expect(connection.visualEvents).toContainEqual({
      t: "death",
      id: "enemy-1",
      x: 5,
      y: 6,
      defId: "slime",
      targetKind: "enemy",
    });
  });
});
