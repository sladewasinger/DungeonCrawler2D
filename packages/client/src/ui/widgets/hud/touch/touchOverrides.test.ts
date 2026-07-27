import { describe, expect, it } from "vitest";
import { WidgetRegistry } from "../../registry.js";
import {
  applyTouchLayoutOverrides,
  captureTouchLayoutOverrides,
  restoreTouchLayoutOverrides,
} from "./touchOverrides.js";

describe("touch layout override lifecycle", () => {
  it("restores the exact desktop layout after touch demotion", () => {
    const registry = new WidgetRegistry();
    registry.setOverride("health", {
      offset: { x: 23, y: 17 },
      scale: 0.9,
    });
    const desktopHealth = registry.getOverride("health");
    const desktopWeapon = registry.getOverride("weapon");
    const snapshot = captureTouchLayoutOverrides(registry);

    applyTouchLayoutOverrides(registry, { width: 390, height: 844 });
    expect(registry.getOverride("weapon")?.visible).toBe(false);
    expect(registry.getOverride("health")).not.toEqual(desktopHealth);

    restoreTouchLayoutOverrides(registry, snapshot);
    expect(registry.getOverride("health")).toEqual(desktopHealth);
    expect(registry.getOverride("weapon")).toEqual(desktopWeapon);
  });
});
