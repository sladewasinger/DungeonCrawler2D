// Headless tests for the saved-over-default layout merge — no Phaser/DOM.
import { describe, expect, it } from "vitest";
import { mergeLayoutConfigs } from "./mergeLayout.js";
import { createEmptyConfig, type LayoutConfig } from "./state.js";

function config(widgets: LayoutConfig["widgets"], hudScale?: number): LayoutConfig {
  return hudScale === undefined ? { version: 1, widgets } : { version: 1, hudScale, widgets };
}

describe("mergeLayoutConfigs", () => {
  it("a widget only in defaults keeps its shipped placement", () => {
    const defaults = config({ health: { anchor: "top-left", offset: { x: 16, y: 16 } } });
    const saved = createEmptyConfig();
    const merged = mergeLayoutConfigs(defaults, saved);
    expect(merged.widgets.health).toEqual({ anchor: "top-left", offset: { x: 16, y: 16 } });
  });

  it("a widget only in saved (e.g. a stale id no longer shipped) still merges through", () => {
    const defaults = createEmptyConfig();
    const saved = config({ ghost: { visible: false } });
    const merged = mergeLayoutConfigs(defaults, saved);
    expect(merged.widgets.ghost).toEqual({ visible: false });
  });

  it("saved fields win over default fields for a widget present in both", () => {
    const defaults = config({ health: { anchor: "top-left", offset: { x: 16, y: 16 } } });
    const saved = config({ health: { anchor: "bottom-right", offset: { x: -20, y: -20 } } });
    const merged = mergeLayoutConfigs(defaults, saved);
    expect(merged.widgets.health).toEqual({ anchor: "bottom-right", offset: { x: -20, y: -20 } });
  });

  it("merges per field, not per widget: a saved partial override falls back to the default's other fields", () => {
    const defaults = config({ health: { anchor: "top-left", offset: { x: 16, y: 16 } } });
    const saved = config({ health: { visible: false } });
    const merged = mergeLayoutConfigs(defaults, saved);
    // visible comes from saved; anchor/offset still come from the default the saved blob never touched.
    expect(merged.widgets.health).toEqual({ anchor: "top-left", offset: { x: 16, y: 16 }, visible: false });
  });

  it("a newly-shipped default widget the saved blob predates still comes through untouched", () => {
    const defaults = config({
      health: { anchor: "top-left", offset: { x: 16, y: 16 } },
      minimap: { anchor: "top-right", offset: { x: -16, y: 188 } },
    });
    // Simulates an older save captured before "minimap" existed in default-layout.json.
    const saved = config({ health: { offset: { x: 24, y: 24 } } });
    const merged = mergeLayoutConfigs(defaults, saved);
    expect(merged.widgets.minimap).toEqual({ anchor: "top-right", offset: { x: -16, y: 188 } });
    expect(merged.widgets.health).toEqual({ anchor: "top-left", offset: { x: 24, y: 24 } });
  });

  it("saved hudScale wins, falling back to the default's when saved omits it", () => {
    const defaults = config({}, 2);
    expect(mergeLayoutConfigs(defaults, config({}, 3)).hudScale).toBe(3);
    expect(mergeLayoutConfigs(defaults, config({})).hudScale).toBe(2);
  });
});
