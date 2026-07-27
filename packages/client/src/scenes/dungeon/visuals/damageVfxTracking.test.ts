import { describe, expect, it, vi } from "vitest";
import type {
  MonsterEntityView,
  PlayerEntityView,
} from "../../../render/entities/geometry/index.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import { syncDamageVfx } from "./damageVfxTracking.js";

function player(hp: number): PlayerEntityView {
  return {
    id: "self",
    playerId: "self",
    name: "Crawler",
    x: 4,
    y: 5,
    z: 0,
    hp,
    maxHp: 30,
    fx: [],
    faceX: 1,
    faceY: 0,
    air: false,
    downed: false,
    attacking: false,
    blocking: false,
    weaponId: "sword",
    weaponAimAngle: 0,
    attackAngleRad: 0,
  };
}

function monster(hp: number): MonsterEntityView {
  return {
    id: "skeleton",
    defId: "skeleton",
    name: "Skeleton",
    x: 7,
    y: 8,
    z: 0,
    hp,
    maxHp: 10,
    fx: [],
    anim: "idle",
    faceX: -1,
    air: false,
  };
}

describe("live dungeon damage VFX tracking", () => {
  it("does not infer impact presentation from rendered HP snapshots", () => {
    const spawnBloodHit = vi.fn();
    const vfx = { spawnBloodHit } as unknown as VfxSystem;
    const tracked = new Map();
    const seen = new Set<string>();
    const world = { groundAt: () => 0.5 };

    syncDamageVfx(
      tracked, seen, world, vfx, [player(30)], [monster(10)],
      new Map(), "self", 100,
    );
    syncDamageVfx(
      tracked, seen, world, vfx, [player(26)], [monster(7)],
      new Map(), "self", 150,
    );

    expect(spawnBloodHit).not.toHaveBeenCalled();
  });

  it("does not spawn on initialization, healing, or unchanged HP", () => {
    const spawnBloodHit = vi.fn();
    const vfx = { spawnBloodHit } as unknown as VfxSystem;
    const tracked = new Map();
    const seen = new Set<string>();
    const world = { groundAt: () => 0 };

    syncDamageVfx(
      tracked, seen, world, vfx, [player(20)], [],
      new Map(), "self", 100,
    );
    syncDamageVfx(
      tracked, seen, world, vfx, [player(21)], [],
      new Map(), "self", 150,
    );

    expect(spawnBloodHit).not.toHaveBeenCalled();
  });

  it("leaves the selected player body and maximum gore on player death", () => {
    const spawnBloodDeath = vi.fn();
    const spawnDeathGore = vi.fn();
    const onOwnDeath = vi.fn();
    const vfx = {
      spawnBloodDeath,
      spawnDeathGore,
      onOwnDeath,
    } as unknown as VfxSystem;

    syncDamageVfx(
      new Map(),
      new Set(),
      { groundAt: () => 0.75 },
      vfx,
      [],
      [],
      new Map(),
      "self",
      200,
      [{
        t: "death",
        id: "self",
        x: 4,
        y: 5,
        targetKind: "player",
        skin: "wizzard_f",
      }],
    );

    expect(spawnDeathGore).toHaveBeenCalledWith(
      4,
      5,
      0.75,
      undefined,
      200,
      { targetKind: "player" },
      "wizzard_f",
      undefined,
    );
    expect(onOwnDeath).toHaveBeenCalledWith(200);
  });
});
