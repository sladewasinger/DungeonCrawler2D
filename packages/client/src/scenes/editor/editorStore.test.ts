// Headless tests for the torch brush's paint/erase wiring and the lighting panel's
// store-side contract: notifyLightingChange re-renders the Phaser view without writing
// a spurious save, which is what lets the sliders debounce-rebake on every drag tick.
import { describe, expect, it } from "vitest";
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
    store.brush = { kind: "height", value: 3 };
    store.paint(6, 6);
    store.brush = { kind: "torch" };
    store.paint(6, 6);
    expect(store.world.hasTorch(6, 6)).toBe(true);
    store.eraseTorchAt(6, 6);
    expect(store.world.hasTorch(6, 6)).toBe(false);
    expect(store.world.heightAt(6, 6)).toBe(3);
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
