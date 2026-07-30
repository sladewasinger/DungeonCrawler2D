import { describe, expect, it, vi } from "vitest";
import type { Connection } from "../../../net/connection/connection.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import { applyVisualEvents } from "./visualEvents.js";

const hiddenLighting = {
  presentationVisibility: () => ({
    revision: 1,
    isWorldPositionVisible: () => false,
  }),
};

describe("Toon visual event visibility", () => {
  it("does not instantiate hidden remote health or impact visuals", () => {
    const spawnDamageNumber = vi.fn();
    const spawnBloodHit = vi.fn();
    const connection = {
      hp: 30,
      maxHp: 30,
      welcome: { playerId: "player-1" },
      body: { kx: 0, ky: 0 },
      entities: new Map([["enemy-1", { snap: { kind: "enemy", x: 8, y: 9, defId: "slime" } }]]),
      world: { groundAt: () => 1 },
      drainVisualEvents: () => [
        { t: "health", id: "enemy-1", delta: -3, kind: "damage" },
        { t: "damageImpact", id: "enemy-1", amount: 3 },
      ],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber,
      spawnBloodHit,
      onOwnHit: vi.fn(),
    } as unknown as VfxSystem;

    applyVisualEvents({
      conn: connection,
      vfx,
      render: { x: 2, y: 3, z: 0 },
      pendingSwings: new Map(),
      nowMs: 100,
      lighting: hiddenLighting,
    });

    expect(spawnDamageNumber).not.toHaveBeenCalled();
    expect(spawnBloodHit).not.toHaveBeenCalled();
  });

  it("keeps self feedback and global flourishes when Toon hides world positions", () => {
    const spawnDamageNumber = vi.fn();
    const spawnBloodHit = vi.fn();
    const spawnLevelUpFlourish = vi.fn();
    const connection = {
      hp: 20,
      maxHp: 30,
      body: { kx: 0, ky: 0 },
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: { groundAt: () => 0 },
      drainVisualEvents: () => [
        { t: "health", id: "player-1", delta: -4, kind: "damage" },
        { t: "damageImpact", id: "player-1", amount: 4 },
        { t: "levelUp", level: 2 },
      ],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber,
      spawnBloodHit,
      onOwnHit: vi.fn(),
      spawnLevelUpFlourish,
    } as unknown as VfxSystem;

    applyVisualEvents({
      conn: connection,
      vfx,
      render: { x: 2, y: 3, z: 0 },
      pendingSwings: new Map(),
      nowMs: 100,
      lighting: hiddenLighting,
    });

    expect(spawnDamageNumber).toHaveBeenCalledTimes(1);
    expect(spawnBloodHit).toHaveBeenCalledTimes(1);
    expect(spawnLevelUpFlourish).toHaveBeenCalledWith(2, 100);
  });

  it("keeps the local fistbump and suppresses a hidden partner flourish", () => {
    const spawnFistbumpFlourish = vi.fn();
    const connection = {
      hp: 30,
      maxHp: 30,
      welcome: { playerId: "player-1" },
      entities: new Map([["player-2", { snap: { kind: "player", name: "Rex", x: 8, y: 9 } }]]),
      world: null,
      drainVisualEvents: () => [{ t: "fistbumpSealed", partnerName: "Rex" }],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnFistbumpFlourish,
    } as unknown as VfxSystem;

    applyVisualEvents({
      conn: connection,
      vfx,
      render: { x: 2, y: 3, z: 0 },
      pendingSwings: new Map(),
      nowMs: 100,
      lighting: hiddenLighting,
    });

    expect(spawnFistbumpFlourish).toHaveBeenCalledTimes(1);
    expect(spawnFistbumpFlourish).toHaveBeenCalledWith(2, 3);
  });
});
