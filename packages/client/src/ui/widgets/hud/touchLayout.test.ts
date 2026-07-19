// Headless test: the shipped default layout places the two touch-control widgets
// at opposite bottom edges (joystick bottom-left, buttons bottom-right) so a
// mobile screenshot never needs live Phaser objects to catch a wrong anchor.
import { describe, expect, it } from "vitest";
import { WidgetRegistry } from "../registry.js";
import type { WidgetDefinition } from "../state.js";

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
