import { LEVEL, World, type ServerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { applySnapshot } from "./apply.js";
import { Connection } from "./connection.js";

function exhaustedSnapshot(): ServerSnapshot {
  return {
    type: "snapshot",
    tick: 1,
    lastSeq: 0,
    lastProjectedServerTick: 0,
    self: {
      x: 0,
      y: 0,
      z: 0,
      zVel: 0,
      grounded: true,
      coyoteTime: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      kx: 0,
      ky: 0,
      hp: 10,
      maxHp: 10,
      stamina: 0,
      maxStamina: 100,
      blocking: false,
      staminaRecoveryDelaySeconds: 4,
      staminaExhausted: true,
      fx: [],
    },
    inventory: [],
    hotbar: [],
    weapon: "sword",
    party: null,
    entities: [],
    left: [],
    events: [],
    areas: [],
  };
}

describe("authoritative stamina exhaustion", () => {
  it("stays at zero through local prediction while the recovery delay counts down", () => {
    const conn = new Connection("wss://example.test", "Tester", "client-1");
    conn.world = new World(12345, 1, LEVEL.Dungeon);
    conn.status = "connected";

    applySnapshot(conn, exhaustedSnapshot());
    conn.sampleInput({
      moveX: 0,
      moveY: 0,
      jump: false,
      block: true,
    });

    expect(conn.stamina).toBe(0);
    expect(conn.staminaRecoveryDelaySeconds).toBeCloseTo(3.95);
    expect(conn.staminaExhausted).toBe(true);
    expect(conn.blocking).toBe(false);
    expect(conn.canBlock).toBe(false);
  });
});
