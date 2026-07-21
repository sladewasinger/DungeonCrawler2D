// Headless tests for the torch brush's paint/erase wiring and the lighting panel's
// store-side contract: notifyLightingChange re-renders the Phaser view without writing
// a spurious save, which is what lets the sliders debounce-rebake on every drag tick.
import { afterEach, describe, expect, it } from "vitest";
import { getViewOrientation, resetViewOrientation } from "../../render/view/index.js";
import { EditorStore } from "./editorStore.js";

/** Node's default vitest environment (see root vitest.config.ts) has no `localStorage`
 * global — a minimal in-memory stand-in for the two methods EditorStore actually calls,
 * plus a write counter so tests can assert "did / didn't persist" precisely. */
function installFakeLocalStorage(): { setCalls: number } {
  const backing = new Map<string, string>();
  const tracker = { setCalls: 0 };
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      tracker.setCalls++;
      backing.set(key, value);
    },
    removeItem: (key: string) => void backing.delete(key),
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  return tracker;
}

describe("EditorStore torch brush", () => {
  it("paints a torch and it survives an export/import round-trip", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.brush = { kind: "torch" };
    store.paint(5, 5);
    expect(store.world.hasTorch(5, 5)).toBe(true);
    const reloaded = new EditorStore();
    reloaded.importJson(store.exportJson());
    expect(reloaded.world.hasTorch(5, 5)).toBe(true);
  });

  it("right-click erase with the torch brush removes only the torch, leaving the tile untouched", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    // (0,0) is untouched by the seeded demo pattern, so 3 wall paints land at exactly z3.
    store.brush = { kind: "wall" };
    store.paint(0, 0);
    store.paint(0, 0);
    store.paint(0, 0);
    store.brush = { kind: "torch" };
    store.paint(0, 0);
    expect(store.world.hasTorch(0, 0)).toBe(true);
    store.eraseTorchAt(0, 0);
    expect(store.world.hasTorch(0, 0)).toBe(false);
    expect(store.world.heightAt(0, 0)).toBe(3);
  });
});

describe("EditorStore autotile mask cache", () => {
  it("resolves an isolated painted wall's mask immediately (no full-map recompute needed to see it)", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.brush = { kind: "wall" };
    store.paint(0, 0); // untouched by the seeded demo pattern
    expect(store.autotileMasks.get(0, 0)?.mask4).toBe(0);
    expect(store.autotileMasks.get(0, 0)?.edges).toEqual({ north: true, east: true, south: true, west: true });
  });

  it("updates a neighbor's mask when a second wall is painted beside it", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.brush = { kind: "wall" };
    store.paint(0, 0);
    store.paint(1, 0);
    expect(store.autotileMasks.get(0, 0)?.edges.east).toBe(false);
    expect(store.autotileMasks.get(1, 0)?.edges.west).toBe(false);
  });

  it("toggleAutotileDebug flips the flag and notifies listeners", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    let notified = false;
    store.onChange(() => (notified = true));
    expect(store.showAutotileDebug).toBe(false);
    store.toggleAutotileDebug();
    expect(store.showAutotileDebug).toBe(true);
    expect(notified).toBe(true);
  });

  it("rebuilds the whole mask cache on import", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.brush = { kind: "wall" };
    store.paint(3, 3);
    store.paint(4, 3);
    const reloaded = new EditorStore();
    reloaded.importJson(store.exportJson());
    expect(reloaded.autotileMasks.get(3, 3)?.edges.east).toBe(false);
    expect(reloaded.autotileMasks.get(4, 3)?.edges.west).toBe(false);
  });
});

describe("EditorStore.rotateView", () => {
  afterEach(() => resetViewOrientation()); // the seam's ViewOrientation is a module-level singleton — reset so it can't leak into another test file's expectations of orientation 0

  it("steps the seam's live ViewOrientation clockwise/counter-clockwise and notifies listeners", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    let notifyCount = 0;
    store.onChange(() => notifyCount++);
    expect(getViewOrientation()).toBe(0);

    store.rotateView(1);
    expect(getViewOrientation()).toBe(90);
    expect(notifyCount).toBe(1);

    store.rotateView(-1);
    expect(getViewOrientation()).toBe(0);
    expect(notifyCount).toBe(2);

    store.rotateView(-1);
    expect(getViewOrientation()).toBe(270);
  });
});

describe("EditorStore.notifyLightingChange", () => {
  it("fires onChange listeners (the lighting panel's live-rebake hook) without persisting a save", () => {
    const tracker = installFakeLocalStorage();
    const store = new EditorStore();
    const callsAfterConstruct = tracker.setCalls;
    let notified = false;
    store.onChange(() => (notified = true));
    store.notifyLightingChange();
    expect(notified).toBe(true);
    expect(tracker.setCalls).toBe(callsAfterConstruct);
  });
});
