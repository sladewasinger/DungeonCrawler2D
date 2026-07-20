// Headless test: the shipped default layout places the two touch-control widgets
// at opposite bottom edges (joystick bottom-left, buttons bottom-right) so a
// mobile screenshot never needs live Phaser objects to catch a wrong anchor.
import { describe, expect, it } from "vitest";
import { WidgetRegistry } from "../registry.js";
import type { WidgetDefinition } from "../state.js";
import { applyTouchLayoutOverrides } from "./touchOverrides.js";

const VIEWPORT = { width: 844, height: 390 };

function stubDefinition(id: string): WidgetDefinition {
  return { id, defaultAnchor: "top-left", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible: true };
}

describe("touch widget layout entries", () => {
  it("registers both touch-stick and touch-buttons in the shipped default layout", () => {
    const registry = new WidgetRegistry();
    registry.register(stubDefinition("touch-stick"));
    registry.register(stubDefinition("touch-buttons"));
    const resolved = registry.resolve(VIEWPORT);
    expect(resolved.has("touch-stick")).toBe(true);
    expect(resolved.has("touch-buttons")).toBe(true);
  });

  it("anchors the joystick bottom-left and the action buttons bottom-right", () => {
    const registry = new WidgetRegistry();
    registry.register(stubDefinition("touch-stick"));
    registry.register(stubDefinition("touch-buttons"));
    const resolved = registry.resolve(VIEWPORT);
    expect(resolved.get("touch-stick")?.anchor).toBe("bottom-left");
    expect(resolved.get("touch-buttons")?.anchor).toBe("bottom-right");
  });

  it("resolves the joystick to the left half of the screen and the buttons to the right half", () => {
    const registry = new WidgetRegistry();
    registry.register(stubDefinition("touch-stick"));
    registry.register(stubDefinition("touch-buttons"));
    const resolved = registry.resolve(VIEWPORT);
    expect(resolved.get("touch-stick")?.x).toBeLessThan(VIEWPORT.width / 2);
    expect(resolved.get("touch-buttons")?.x).toBeGreaterThan(VIEWPORT.width / 2);
  });

  it("keeps both controls in the bottom half of the screen, clear of the top HUD", () => {
    const registry = new WidgetRegistry();
    registry.register(stubDefinition("touch-stick"));
    registry.register(stubDefinition("touch-buttons"));
    const resolved = registry.resolve(VIEWPORT);
    expect(resolved.get("touch-stick")?.y).toBeGreaterThan(VIEWPORT.height / 2);
    expect(resolved.get("touch-buttons")?.y).toBeGreaterThan(VIEWPORT.height / 2);
  });
});

// Wave-6 playtest ("barely any screen real estate"): the joystick/action-buttons/bag
// cluster steps down a further narrow-viewport factor on top of its base touch scale.
describe("applyTouchLayoutOverrides' narrow-viewport shrink", () => {
  function registryWithControls(): WidgetRegistry {
    const registry = new WidgetRegistry();
    registry.register(stubDefinition("touch-stick"));
    registry.register(stubDefinition("touch-buttons"));
    registry.register(stubDefinition("inventory-toggle"));
    return registry;
  }

  it("keeps the controls at full (hudScale-only) size on a roomy viewport", () => {
    const registry = registryWithControls();
    const wide = { width: 1280, height: 800 };
    applyTouchLayoutOverrides(registry, wide);
    const resolved = registry.resolve(wide);
    expect(resolved.get("touch-stick")?.scale).toBe(2);
    expect(resolved.get("touch-buttons")?.scale).toBe(2);
    expect(resolved.get("inventory-toggle")?.scale).toBe(2);
  });

  it("shrinks the controls a further step on a narrow phone-portrait viewport", () => {
    const registry = registryWithControls();
    const narrowPortrait = { width: 390, height: 844 };
    applyTouchLayoutOverrides(registry, narrowPortrait);
    const resolved = registry.resolve(narrowPortrait);
    expect(resolved.get("touch-stick")?.scale).toBe(1);
    expect(resolved.get("touch-buttons")?.scale).toBe(1);
    expect(resolved.get("inventory-toggle")?.scale).toBe(1);
  });

  it("applies the same shrink to the equivalent landscape viewport — height, not width, is the tight axis", () => {
    const registry = registryWithControls();
    const narrowLandscape = { width: 844, height: 390 };
    applyTouchLayoutOverrides(registry, narrowLandscape);
    const resolved = registry.resolve(narrowLandscape);
    expect(resolved.get("touch-stick")?.scale).toBe(1);
    expect(resolved.get("touch-buttons")?.scale).toBe(1);
  });

  it("never touches a window panel's own scale override — the base 0.5 (touch) value is untouched at any viewport", () => {
    const registry = registryWithControls();
    registry.register(stubDefinition("inventory"));
    const narrow = { width: 390, height: 844 };
    applyTouchLayoutOverrides(registry, narrow);
    // 0.5 (window's touch scale) * HUD_SCALE(2) = 1 regardless of viewport — asserting this
    // documents *why* windows don't get a narrow-viewport factor (layout.ts rounds to an
    // integer container scale, so windows already sit at the achievable floor).
    expect(registry.resolve(narrow).get("inventory")?.scale).toBe(1);
  });
});
