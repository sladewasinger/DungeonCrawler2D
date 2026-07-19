// Headless tests for widget layout resolution — no Phaser/DOM involved.
import { beforeEach, describe, expect, it } from "vitest";
import { anchorPoint } from "./anchors.js";
import { resolveLayout } from "./layout.js";
import { WidgetRegistry } from "./registry.js";
import { createRegistryState, type WidgetDefinition, type WidgetRegistryState } from "./state.js";

const VIEWPORT = { width: 1280, height: 720 };

function healthDefinition(): WidgetDefinition {
  return { id: "health", defaultAnchor: "top-left", defaultOffset: { x: 16, y: 16 }, defaultScale: 1, defaultVisible: true };
}

describe("anchorPoint", () => {
  it("resolves all nine anchors against the viewport", () => {
    expect(anchorPoint("top-left", VIEWPORT)).toEqual({ x: 0, y: 0 });
    expect(anchorPoint("bottom-right", VIEWPORT)).toEqual({ x: 1280, y: 720 });
    expect(anchorPoint("center", VIEWPORT)).toEqual({ x: 640, y: 360 });
    expect(anchorPoint("bottom-center", VIEWPORT)).toEqual({ x: 640, y: 720 });
  });
});

describe("resolveLayout", () => {
  let state: WidgetRegistryState;

  beforeEach(() => {
    state = createRegistryState();
  });

  it("adds a widget's offset to its anchor point", () => {
    state.definitions.set("health", healthDefinition());
    const resolved = resolveLayout(state, VIEWPORT);
    expect(resolved.get("health")).toEqual({ anchor: "top-left", x: 16, y: 16, scale: 1, visible: true });
  });

  it("an override replaces only the fields it sets, keeping the rest at default", () => {
    state.definitions.set("health", healthDefinition());
    state.overrides.set("health", { scale: 2 });
    const resolved = resolveLayout(state, VIEWPORT);
    expect(resolved.get("health")).toEqual({ anchor: "top-left", x: 16, y: 16, scale: 2, visible: true });
  });

  it("an override can move a widget to a different anchor entirely", () => {
    state.definitions.set("health", healthDefinition());
    state.overrides.set("health", { anchor: "bottom-right", offset: { x: -16, y: -16 } });
    const resolved = resolveLayout(state, VIEWPORT);
    expect(resolved.get("health")).toEqual({ anchor: "bottom-right", x: 1264, y: 704, scale: 1, visible: true });
  });

  it("a hidden override suppresses the widget without unregistering it", () => {
    state.definitions.set("health", healthDefinition());
    state.overrides.set("health", { visible: false });
    expect(resolveLayout(state, VIEWPORT).get("health")?.visible).toBe(false);
  });

  it("only resolves widgets that are actually registered", () => {
    state.overrides.set("ghost", { visible: false });
    expect(resolveLayout(state, VIEWPORT).size).toBe(0);
  });
});

describe("WidgetRegistry facade", () => {
  it("applies the shipped default-layout.json on construction", () => {
    const registry = new WidgetRegistry();
    registry.register(healthDefinition());
    const resolved = registry.resolve(VIEWPORT);
    // default-layout.json places health at top-left (16,16), same as its own default.
    expect(resolved.get("health")).toEqual({ anchor: "top-left", x: 16, y: 16, scale: 1, visible: true });
  });

  it("setOverride is additive across calls", () => {
    const registry = new WidgetRegistry();
    registry.register(healthDefinition());
    registry.setOverride("health", { scale: 1.5 });
    registry.setOverride("health", { visible: false });
    const resolved = registry.resolve(VIEWPORT).get("health");
    expect(resolved?.scale).toBe(1.5);
    expect(resolved?.visible).toBe(false);
  });

  it("resetToDefault(id) drops a per-widget override back to the shipped layout", () => {
    const registry = new WidgetRegistry();
    registry.register(healthDefinition());
    registry.setOverride("health", { anchor: "center", offset: { x: 0, y: 0 } });
    registry.resetToDefault("health");
    expect(registry.resolve(VIEWPORT).get("health")).toEqual({ anchor: "top-left", x: 16, y: 16, scale: 1, visible: true });
  });

  it("resetToDefault() with no id resets every widget", () => {
    const registry = new WidgetRegistry();
    registry.register(healthDefinition());
    registry.setOverride("health", { scale: 3 });
    registry.resetToDefault();
    expect(registry.resolve(VIEWPORT).get("health")?.scale).toBe(1);
  });

  it("persist/loadPersisted round-trip through a stubbed localStorage", () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;

    const registry = new WidgetRegistry();
    registry.register(healthDefinition());
    registry.setOverride("health", { scale: 2.5 });
    registry.persist();

    const reloaded = new WidgetRegistry();
    reloaded.register(healthDefinition());
    reloaded.loadPersisted();
    expect(reloaded.resolve(VIEWPORT).get("health")?.scale).toBe(2.5);

    delete (globalThis as { localStorage?: Storage }).localStorage;
  });
});
