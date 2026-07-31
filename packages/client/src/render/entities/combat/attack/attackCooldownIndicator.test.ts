import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  ATTACK_COOLDOWN_BAR_WIDTH_PX,
  updateAttackCooldownIndicator,
} from "./attackCooldownIndicator.js";

function graphicsProbe() {
  const probe = {
    clear: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: vi.fn(),
    lineStyle: vi.fn(),
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    strokeRect: vi.fn(),
  };
  for (const method of Object.values(probe)) method.mockReturnValue(probe);
  return probe;
}

function update(
  overrides: Partial<Parameters<typeof updateAttackCooldownIndicator>[0]> = {},
) {
  const graphics = graphicsProbe();
  updateAttackCooldownIndicator({
    graphics: graphics as unknown as Phaser.GameObjects.Graphics,
    state: { ready: false, progress: 0.5, remainingMs: 150 },
    x: 100,
    feetY: 120,
    depth: 8,
    blocking: false,
    downed: false,
    ...overrides,
  });
  return graphics;
}

describe("attack cooldown indicator", () => {
  it("draws a high-contrast horizontal recovery fill", () => {
    const graphics = update();

    expect(graphics.fillRect).toHaveBeenCalledTimes(2);
    expect(graphics.fillRect.mock.calls[1]?.[2])
      .toBe(ATTACK_COOLDOWN_BAR_WIDTH_PX * 0.5);
    expect(graphics.strokeRect).toHaveBeenCalledOnce();
    expect(graphics.setVisible).toHaveBeenLastCalledWith(true);
  });

  it("hides when the attack is ready", () => {
    const graphics = update({
      state: { ready: true, progress: 1, remainingMs: 0 },
    });

    expect(graphics.setVisible).toHaveBeenLastCalledWith(false);
    expect(graphics.fillRect).not.toHaveBeenCalled();
  });

  it.each([
    { blocking: true, downed: false },
    { blocking: false, downed: true },
  ])("hides while unavailable: $blocking/$downed", (availability) => {
    const graphics = update(availability);

    expect(graphics.setVisible).toHaveBeenLastCalledWith(false);
    expect(graphics.fillRect).not.toHaveBeenCalled();
  });
});
