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

    applyVisualEvents({ conn: connection, vfx, render: { x: 2, y: 3, z: 0 }, pendingSwings: new Map(), nowMs: 100 });

    expect(spawnDamageNumber).toHaveBeenCalledWith({ x: 2, y: 2.4, feedback: { kind: "heal", delta: 4, label: "+4", color: HEAL_FEEDBACK_COLOR }, nowMs: 100 });
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

    applyVisualEvents({ conn: connection, vfx, render: { x: 2, y: 3, z: 0 }, pendingSwings: new Map(), nowMs: 100 });

    expect(spawnDamageNumber).not.toHaveBeenCalled();
  });

  it("gives old-server damage health events the same impact presentation", () => {
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

    applyVisualEvents({ conn: connection, vfx, render: { x: 2, y: 3, z: 0 }, pendingSwings: new Map(), nowMs: 100 });

    expect(spawnBloodHit).toHaveBeenCalledWith({ x: 2, y: 3, groundHeight: 0.25, defId: undefined, nowMs: 100, direction: { x: 1, y: -0.5 } });
    expect(onOwnHit).toHaveBeenCalledWith(100);
  });

  it("spawns impact blood even when HP did not change", () => {
    const spawnBloodHit = vi.fn();
    const connection = {
      hp: 30,
      maxHp: 30,
      body: { kx: 0.5, ky: -1 },
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: { groundAt: () => 0.25 },
      drainVisualEvents: () => [{
        t: "damageImpact",
        id: "player-1",
        amount: 6,
      }],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber: vi.fn(),
      spawnBloodHit,
      onOwnHit: vi.fn(),
    } as unknown as VfxSystem;

    applyVisualEvents({ conn: connection, vfx, render: { x: 2, y: 3, z: 0 }, pendingSwings: new Map(), nowMs: 100 });

    expect(spawnBloodHit).toHaveBeenCalledWith({ x: 2, y: 3, groundHeight: 0.25, defId: undefined, nowMs: 100, direction: { x: 0.5, y: -1 } });
    expect(vfx.onOwnHit).toHaveBeenCalledWith(100);
  });

  it("does not duplicate blood for a paired health and impact event", () => {
    const spawnBloodHit = vi.fn();
    const connection = {
      hp: 30,
      maxHp: 30,
      body: { kx: 0, ky: 0 },
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: { groundAt: () => 0 },
      drainVisualEvents: () => [
        { t: "health", id: "player-1", delta: -6, kind: "damage" },
        { t: "damageImpact", id: "player-1", amount: 6 },
      ],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber: vi.fn(),
      spawnBloodHit,
      onOwnHit: vi.fn(),
    } as unknown as VfxSystem;

    applyVisualEvents({ conn: connection, vfx, render: { x: 2, y: 3, z: 0 }, pendingSwings: new Map(), nowMs: 100 });

    expect(spawnBloodHit).toHaveBeenCalledTimes(1);
    expect(vfx.onOwnHit).toHaveBeenCalledTimes(1);
  });

});
