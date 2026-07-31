import type Phaser from "phaser";
import type { AttackProfile } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import {
  depthForCombatGeometry,
  depthForCombatReachOverlay,
} from "../../../render/entities/presentation/depthSort.js";
import { MeleeWedgePool } from "./meleeWedge.js";

const position = vi.hoisted(() => ({
  wielderViewY: 0,
  wielderDepth: 0,
}));

vi.mock("../../../render/entities/geometry/worldToScreen.js", () => ({
  combatOverlayPosition: () => ({ wielderViewY: position.wielderViewY }),
  depthForEntityNow: () => position.wielderDepth,
  groundToScreen: (x: number, y: number, z: number) => ({ x, y: y - z }),
}));
vi.mock("../../../render/view/index.js", () => ({
  getViewOrientation: () => 0,
  worldAngleToView: (angle: number) => angle,
}));

const PROFILE: AttackProfile = {
  damage: 9,
  range: 2.4,
  cooldownMs: 350,
  arcCos: 0.7,
  shape: "cone",
  knockbackForce: 10,
};

function graphicsProbe() {
  const probe = {
    clear: vi.fn(),
    destroy: vi.fn(),
    fillCircle: vi.fn(),
    fillPath: vi.fn(),
    fillStyle: vi.fn(),
    lineStyle: vi.fn(),
    setAlpha: vi.fn(),
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    slice: vi.fn(),
    strokeCircle: vi.fn(),
    strokePath: vi.fn(),
  };
  for (const method of Object.values(probe)) method.mockReturnValue(probe);
  return probe;
}

describe("melee wedge position depth", () => {
  it("draws the raw attack area at the body position from the exact profile", () => {
    const graphics = graphicsProbe();
    const scene = {
      add: { graphics: () => graphics },
    } as unknown as Phaser.Scene;
    const pool = new MeleeWedgePool(scene);

    pool.spawn({
      id: "player-1",
      x: 1,
      y: 2,
      z: 0.5,
      angleRad: 0.5,
      depth: 0,
      tilePx: 48,
      nowMs: 1_000,
      profile: PROFILE,
    });

    const halfAngle = Math.acos(PROFILE.arcCos);
    expect(graphics.slice).toHaveBeenNthCalledWith(
      1,
      1,
      1.5,
      PROFILE.range * 48,
      0.5 - halfAngle,
      0.5 + halfAngle,
      false,
    );
  });

  it("uses the spawn-locked reach when the active attack follows movement", () => {
    const graphics = graphicsProbe();
    const scene = {
      add: { graphics: () => graphics },
    } as unknown as Phaser.Scene;
    const pool = new MeleeWedgePool(scene);
    pool.spawn({
      id: "player-1",
      x: 1,
      y: 2,
      z: 0,
      angleRad: 0.5,
      depth: 0,
      tilePx: 48,
      nowMs: 1_000,
      profile: PROFILE,
    });
    graphics.setDepth.mockClear();
    position.wielderViewY = 10.3;
    position.wielderDepth = 1_030;

    pool.updatePosition({ id: "player-1", x: 5, y: 7, z: 0 });

    const overlay = depthForCombatReachOverlay({
      wielderViewY: 10.3,
      wielderDepth: 1_030,
      reachTiles: PROFILE.range,
    });
    expect(graphics.setDepth)
      .toHaveBeenCalledWith(depthForCombatGeometry(overlay));
  });
});
