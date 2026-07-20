// Cursor inspector coverage for the autotile-debug lane's own addition: the mask hex
// readout on hover. Everything else this file's inspectorText composes (stack/face/
// bench text) is exercised elsewhere; this just proves the new segment is wired.
import { describe, expect, it } from "vitest";
import { EditorStore } from "../editorStore.js";
import { inspectorText } from "./inspector.js";

function installFakeLocalStorage(): void {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("inspectorText autotile mask readout", () => {
  it("shows mask=0x00 (8-bit 0x00) for an isolated painted wall", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.brush = { kind: "wall" };
    store.paint(0, 0); // untouched by the seeded demo pattern
    expect(inspectorText(store, 0, 0)).toContain("mask=0x00 (8-bit 0x00)");
  });

  it("shows an updated mask once a neighbor wall is painted beside it", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.brush = { kind: "wall" };
    store.paint(0, 0);
    store.paint(1, 0);
    expect(inspectorText(store, 0, 0)).toContain("mask=0x02"); // E bit set (bit1)
  });
});
