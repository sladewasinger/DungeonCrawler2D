import { describe, expect, it, vi } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { PlayerEntityView, RenderContext } from "../../../render/entities/geometry/index.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import type { DungeonSceneState } from "../orchestration/state.js";
import { syncMeleeSwings } from "./meleeSwingSync.js";

function player(
  overrides: Partial<PlayerEntityView> = {},
): PlayerEntityView {
  return {
    id: "player-1",
    playerId: "player-1",
    name: "Wren",
    x: 2,
    y: 3,
    z: 0,
    hp: 30,
    maxHp: 30,
    fx: [],
    faceX: 1,
    faceY: 0,
    air: false,
    downed: false,
    attacking: true,
    blocking: false,
    weaponId: "sword",
    weaponAimAngle: null,
    attackAngleRad: 0.25,
    ...overrides,
  };
}

function combatState(): DungeonSceneState {
  return {
    attackFlags: new Map(),
    swingSpawns: [],
    swingSpawnRecords: [],
    swingSeen: new Set(),
    pendingSwings: new Map(),
  } as unknown as DungeonSceneState;
}

describe("melee swing position sync", () => {
  it("follows active movement without replacing spawn-locked geometry", () => {
    const vfx = {
      spawnMeleeSwing: vi.fn(),
      updateMeleeSwingPosition: vi.fn(),
    };
    const state = combatState();
    const first = player();
    syncMeleeSwings({
      vfx: vfx as unknown as VfxSystem,
      state,
      players: [first],
      nowMs: 1_000,
      context: {} as RenderContext,
    });

    expect(vfx.spawnMeleeSwing).toHaveBeenCalledWith(expect.objectContaining({
      angleRad: 0.25,
      profile: expect.objectContaining({ profileId: "sword" }),
      tilePx: SCREEN_TILE_PX,
    }));
    vfx.spawnMeleeSwing.mockClear();
    vfx.updateMeleeSwingPosition.mockClear();

    syncMeleeSwings({
      vfx: vfx as unknown as VfxSystem,
      state,
      players: [player({
        x: 5,
        y: 7,
        z: 1,
        attackAngleRad: 2.5,
        weaponId: "hammer",
      })],
      nowMs: 1_050,
      context: {} as RenderContext,
    });

    expect(vfx.spawnMeleeSwing).not.toHaveBeenCalled();
    expect(vfx.updateMeleeSwingPosition).toHaveBeenCalledWith({
      id: "player-1",
      x: 5,
      y: 7,
      z: 1,
    });
  });

  it("stops following after the active attack pulse", () => {
    const vfx = {
      spawnMeleeSwing: vi.fn(),
      updateMeleeSwingPosition: vi.fn(),
    };
    const state = combatState();
    syncMeleeSwings({
      vfx: vfx as unknown as VfxSystem,
      state,
      players: [player()],
      nowMs: 1_000,
      context: {} as RenderContext,
    });
    vfx.updateMeleeSwingPosition.mockClear();

    syncMeleeSwings({
      vfx: vfx as unknown as VfxSystem,
      state,
      players: [player({ attacking: false, x: 8 })],
      nowMs: 1_160,
      context: {} as RenderContext,
    });

    expect(vfx.updateMeleeSwingPosition).not.toHaveBeenCalled();
  });
});
