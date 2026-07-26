/** Ensures authoritative healing feedback never enters the damage/blood presentation path. */
import { describe, expect, it, vi } from "vitest";
import type { Connection } from "../../net/connection.js";
import { HEAL_FEEDBACK_COLOR } from "../../ui/healthFeedback.js";
import type { VfxSystem } from "../../vfx/index.js";
import { applyVisualEvents } from "./visualEvents.js";

describe("visual health events", () => {
  it("shows green +4 feedback without blood or own-hit reactions", () => {
    const spawnDamageNumber = vi.fn();
    const spawnBloodHit = vi.fn();
    const onOwnHit = vi.fn();
    const connection = {
      hp: 14,
      maxHp: 30,
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: null,
      drainVisualEvents: () => [{
        t: "health",
        id: "player-1",
        delta: 4,
        kind: "heal",
      }],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber,
      spawnBloodHit,
      onOwnHit,
    } as unknown as VfxSystem;

    applyVisualEvents(
      connection,
      vfx,
      { x: 2, y: 3, z: 0 },
      new Map(),
      100,
    );

    expect(spawnDamageNumber).toHaveBeenCalledWith(
      2,
      2.4,
      {
        kind: "heal",
        delta: 4,
        label: "+4",
        color: HEAL_FEEDBACK_COLOR,
      },
      100,
    );
    expect(spawnBloodHit).not.toHaveBeenCalled();
    expect(onOwnHit).not.toHaveBeenCalled();
  });

  it("suppresses floating feedback for basic automatic healing", () => {
    const spawnDamageNumber = vi.fn();
    const connection = {
      hp: 15,
      maxHp: 30,
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: null,
      drainVisualEvents: () => [{
        t: "health",
        id: "player-1",
        delta: 1,
        kind: "heal",
        source: "automatic",
      }],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber,
    } as unknown as VfxSystem;

    applyVisualEvents(connection, vfx, { x: 2, y: 3, z: 0 }, new Map(), 100);

    expect(spawnDamageNumber).not.toHaveBeenCalled();
  });

  it("routes authoritative damage into own-hit feedback", () => {
    const spawnBloodHit = vi.fn();
    const onOwnHit = vi.fn();
    const connection = {
      hp: 25,
      maxHp: 30,
      body: { kx: 1, ky: -0.5 },
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: { groundAt: () => 0.25 },
      drainVisualEvents: () => [{
        t: "health",
        id: "player-1",
        delta: -5,
        kind: "damage",
      }],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber: vi.fn(),
      spawnBloodHit,
      onOwnHit,
    } as unknown as VfxSystem;

    applyVisualEvents(connection, vfx, { x: 2, y: 3, z: 0 }, new Map(), 100);

    expect(spawnBloodHit).not.toHaveBeenCalled();
    expect(onOwnHit).toHaveBeenCalledWith(100);
  });

});
