import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { BLOCK_FEEDBACK_DURATION_MS } from "../../../../combat/blockFeedback.js";
import type { PlayerVisual } from "../../visuals/state.js";
import {
  updateGuardCone,
  type GuardConeUpdate,
} from "./guardCone.js";

function graphicsProbe() {
  const probe = {
    clear: vi.fn(),
    fillCircle: vi.fn(),
    fillPath: vi.fn(),
    fillStyle: vi.fn(),
    lineStyle: vi.fn(),
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    slice: vi.fn(),
    strokeCircle: vi.fn(),
    strokePath: vi.fn(),
  };
  for (const method of Object.values(probe)) method.mockReturnValue(probe);
  return probe;
}

function guardConeInput(
  cone: ReturnType<typeof graphicsProbe>,
  overrides: Partial<Pick<GuardConeUpdate, "blockFeedback" | "blocking" | "nowMs">> = {},
): GuardConeUpdate {
  return {
    visual: {
      body: { x: 100, y: 120 },
      guardCone: cone as unknown as Phaser.GameObjects.Graphics,
    } as PlayerVisual,
    blocking: false,
    facingAngle: 0,
    depth: { wielderDepth: 0, wielderViewY: 0 },
    nowMs: 1_000,
    originX: 100,
    originY: 120,
    ...overrides,
  };
}

describe("guard cone graphics", () => {
  it("hides the graphics while idle", () => {
    const cone = graphicsProbe();

    updateGuardCone(guardConeInput(cone));

    expect(cone.clear).toHaveBeenCalledOnce();
    expect(cone.setVisible).toHaveBeenLastCalledWith(false);
    expect(cone.fillStyle).not.toHaveBeenCalled();
  });

  it("draws a normal held guard in blue without a radial circle", () => {
    const cone = graphicsProbe();

    updateGuardCone(guardConeInput(cone, { blocking: true }));

    expect(cone.fillStyle).toHaveBeenCalledWith(0x28658d, 0.34);
    expect(cone.fillCircle).not.toHaveBeenCalled();
    expect(cone.strokeCircle).not.toHaveBeenCalled();
    expect(cone.setVisible).toHaveBeenLastCalledWith(true);
  });

  it("flashes the held guard yellow for fresh block feedback", () => {
    const cone = graphicsProbe();

    updateGuardCone(guardConeInput(cone, {
      blocking: true,
      blockFeedback: { kind: "melee", startedAtMs: 1_000 },
    }));

    expect(cone.fillStyle).toHaveBeenCalledWith(0xffe07a, 0.5);
    expect(cone.fillCircle).not.toHaveBeenCalled();
  });

  it("returns the held guard to blue after feedback expires", () => {
    const cone = graphicsProbe();

    updateGuardCone(guardConeInput(cone, {
      blocking: true,
      blockFeedback: { kind: "projectile", startedAtMs: 1_000 },
      nowMs: 1_000 + BLOCK_FEEDBACK_DURATION_MS,
    }));

    expect(cone.fillStyle).toHaveBeenCalledWith(0x28658d, 0.34);
  });

  it("remains guard-only when blocking", () => {
    const cone = graphicsProbe();

    updateGuardCone(guardConeInput(cone, {
      blocking: true,
    }));

    expect(cone.fillStyle).toHaveBeenCalledWith(0x28658d, 0.34);
    expect(cone.fillStyle).toHaveBeenCalledOnce();
  });
});
