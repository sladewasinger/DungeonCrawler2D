import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FLOOR_CAP, TILE } from "@dc2d/engine";
import { resetViewOrientation, setViewOrientation, worldTileToView } from "../../render/view/index.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { pitFaceRowAt, pitStepFaceRowsAt } from "../../render/terrain/pitFace.js";
import { EditorStore } from "./editorStore.js";
import { problemMapById } from "./problemMaps.js";
import { hoveredCellAt } from "./renderPanelPointer.js";

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

function screenPointFor(vx: number, vy: number): { worldX: number; worldY: number } {
  return { worldX: vx * SCREEN_TILE_PX + 10, worldY: vy * SCREEN_TILE_PX + 10 };
}

describe("raised platform projection repro", () => {
  afterEach(() => resetViewOrientation());

  it("round-trips the authored left-grid height and picks the matching rendered cap in every view", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.importJson(problemMapById("raised-platform-projection").exportJson());

    expect(store.world.cellAt(5, 5)).toEqual({ tile: TILE.Floor, height: 3 });
    expect(store.world.stackAt(5, 5)).toMatchObject({ walls: 3, cap: DEFAULT_FLOOR_CAP, stair: null });
    expect(JSON.parse(store.exportJson())).toEqual(JSON.parse(problemMapById("raised-platform-projection").exportJson()));

    for (const orientation of [0, 90, 180, 270] as const) {
      setViewOrientation(orientation);
      const home = worldTileToView({ x: 5, y: 5 }, orientation);
      const point = screenPointFor(home.x, home.y - 3);
      expect(hoveredCellAt(store, point.worldX, point.worldY)).toEqual({
        vx: home.x,
        vy: home.y - 3,
        wx: 5,
        wy: 5,
      });
    }
  });
});

describe("stepped pit repro", () => {
  it("keeps every descending step attached to the same upper rim", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.importJson(problemMapById("stepped-pit").exportJson());

    expect(store.world.cellAt(8, 8)).toEqual({ tile: TILE.Floor, height: -1 });
    expect(store.world.cellAt(8, 9)).toEqual({ tile: TILE.Floor, height: -2 });
    expect(pitFaceRowAt(store.world, 8, 8)).toMatchObject({ rowFromTop: 1, surfaceHeight: 0 });
    expect(pitFaceRowAt(store.world, 8, 9)).toBeNull();
    expect(pitStepFaceRowsAt(store.world, 8, 8)).toMatchObject([{ rowFromTop: 1, surfaceHeight: -1 }]);
  });
});

describe("tower occlusion repro", () => {
  it("puts lower northern caps behind a taller southern tower", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    store.importJson(problemMapById("tower-occlusion").exportJson());

    expect(store.world.cellAt(10, 10)).toEqual({ tile: TILE.Floor, height: 4 });
    expect(store.world.cellAt(10, 9)).toEqual({ tile: TILE.Floor, height: 1 });
    expect(store.world.cellAt(10, 8)).toEqual({ tile: TILE.Floor, height: 1 });
  });
});
