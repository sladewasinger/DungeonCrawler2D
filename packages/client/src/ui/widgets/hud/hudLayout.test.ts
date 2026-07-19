// Headless test: the HUD widget set's ids all resolve from the shipped default layout,
// and a full layout config round-trips through persist/loadPersisted unchanged.
import { beforeEach, describe, expect, it } from "vitest";
import { HUD_SCALE } from "../../hudScale.js";
import { WidgetRegistry } from "../registry.js";
import type { LayoutConfig, WidgetDefinition } from "../state.js";

const VIEWPORT = { width: 1280, height: 720 };
const HUD_WIDGET_IDS = ["health", "hotbar", "buffs", "weapon", "chat", "interaction", "status", "death", "inventory"];

function stubDefinition(id: string): WidgetDefinition {
  return { id, defaultAnchor: "top-left", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible: true };
}

describe("HUD widget ids in the shipped default layout", () => {
  it("every HUD widget resolves a placement out of the box", () => {
    const registry = new WidgetRegistry();
    for (const id of HUD_WIDGET_IDS) registry.register(stubDefinition(id));
    const resolved = registry.resolve(VIEWPORT);
    for (const id of HUD_WIDGET_IDS) expect(resolved.has(id)).toBe(true);
  });

  it("anchors the ping/fps/coords indicator stack ('status') top-right, clear of health/buffs at top-left", () => {
    const registry = new WidgetRegistry();
    for (const id of HUD_WIDGET_IDS) registry.register(stubDefinition(id));
    const resolved = registry.resolve(VIEWPORT);
    expect(resolved.get("status")?.anchor).toBe("top-right");
    expect(resolved.get("status")?.x).toBeGreaterThan(VIEWPORT.width / 2);
  });
});

describe("inventory window's layout entry", () => {
  it("defaults to a centered panel (anchor 'center', zero offset) — HUD_OS.md Phase 1", () => {
    const registry = new WidgetRegistry();
    registry.register({ id: "inventory", defaultAnchor: "center", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible: true });
    const resolved = registry.resolve(VIEWPORT).get("inventory");
    expect(resolved).toMatchObject({ anchor: "center", x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 });
  });
});

describe("layout JSON round-trip through localStorage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("a full HUD layout config persists and reloads with every override intact", () => {
    const registry = new WidgetRegistry();
    for (const id of HUD_WIDGET_IDS) registry.register(stubDefinition(id));
    const overrides: LayoutConfig["widgets"] = {
      health: { anchor: "top-center", offset: { x: 4, y: 4 }, scale: 1.2 },
      hotbar: { visible: false },
      death: { anchor: "bottom-right" },
    };
    for (const [id, override] of Object.entries(overrides)) registry.setOverride(id, override);
    registry.persist();

    const reloaded = new WidgetRegistry();
    for (const id of HUD_WIDGET_IDS) reloaded.register(stubDefinition(id));
    reloaded.loadPersisted();
    const resolved = reloaded.resolve(VIEWPORT);

    // 1.2 * HUD_SCALE (2) = 2.4, rounded to 2 — pixel-font text only ever renders at an integer scale.
    expect(resolved.get("health")).toMatchObject({ anchor: "top-center", scale: Math.round(1.2 * HUD_SCALE) });
    expect(resolved.get("hotbar")?.visible).toBe(false);
    expect(resolved.get("death")?.anchor).toBe("bottom-right");

    delete (globalThis as { localStorage?: Storage }).localStorage;
  });
});
