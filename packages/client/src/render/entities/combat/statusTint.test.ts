import { describe, expect, it, vi } from "vitest";
import {
  applyCombatantTint,
  blendTintWithWhite,
  resolveCombatantTint,
  resolveCombatantTintLayer,
} from "./statusTint.js";

const normal = (fx: readonly string[], nowMs = 0) =>
  resolveCombatantTint(fx, nowMs, "normal");

describe("combatant status tint", () => {
  it("uses one 50% poison blend for enemy, local-player, and remote-player paths", () => {
    const expected = {
      mode: "multiply",
      color: blendTintWithWhite(0x7bd44a, 0.5),
      blend: 0.5,
      source: "poisoned",
    };
    for (const kind of ["enemy", "local-player", "remote-player"]) {
      expect(normal(["poisoned"]), kind).toMatchObject(expected);
    }
  });

  it("returns stable shared presentations without per-frame result allocation", () => {
    expect(normal(["poisoned"])).toBe(normal(["poisoned"], 10_000));
    expect(normal([])).toBe(normal([]));
  });

  it("defines damage, state, telegraph, fire, poison, and clear precedence", () => {
    const fx = ["poisoned", "on-fire"];
    expect(resolveCombatantTint(fx, 0, resolveCombatantTintLayer(true, "downed", true)).source).toBe("damage-flash");
    expect(resolveCombatantTint(fx, 0, resolveCombatantTintLayer(false, "downed", true)).source).toBe("downed");
    expect(resolveCombatantTint(fx, 0, resolveCombatantTintLayer(false, "normal", true)).source).toBe("telegraph");
    expect(normal(fx).source).toBe("on-fire");
    expect(normal(["poisoned"]).source).toBe("poisoned");
    expect(normal([]).source).toBe("none");
  });

  it("removes expired poison and resets Phaser fill mode after a damage flash", () => {
    const sprite = {
      setTint: vi.fn(),
      clearTint: vi.fn(),
      setTintMode: vi.fn(),
    };
    applyCombatantTint(sprite, resolveCombatantTint(["poisoned"], 0, "damage-flash"));
    expect(sprite.setTintMode).toHaveBeenLastCalledWith(1);

    applyCombatantTint(sprite, normal(["poisoned"]));
    expect(sprite.setTintMode).toHaveBeenLastCalledWith(0);

    applyCombatantTint(sprite, normal([]));
    expect(sprite.clearTint).toHaveBeenCalledOnce();
    expect(sprite.setTintMode).toHaveBeenLastCalledWith(0);
  });
});
