/** Verifies the real 2D route wires Phaser's created canvas into fullscreen recovery. */
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const canvas = {} as HTMLCanvasElement;
  return {
    canvas,
    configs: [] as Record<string, unknown>[],
    retry: vi.fn(),
  };
});

vi.mock("phaser", () => ({
  default: {
    AUTO: 1,
    Scale: { RESIZE: 2 },
    Game: class {
      readonly canvas = harness.canvas;
      readonly registry = { set: vi.fn() };

      constructor(config: Record<string, unknown>) {
        harness.configs.push(config);
      }
    },
  },
}));
vi.mock("../boot/PreloadScene.js", () => ({ PreloadScene: class {} }));
vi.mock("../boot/versionRefreshOverlay.js", () => ({ bindVersionRefreshOverlay: vi.fn() }));
vi.mock("../buildInfo.js", () => ({ BUILD_SHA: "test" }));
vi.mock("../net/connection.js", () => ({ Connection: class {} }));
vi.mock("../net/identity.js", () => ({ persistentClientId: () => "client" }));
vi.mock("../net/url.js", () => ({ resolveWsUrl: () => "ws://test" }));
vi.mock("../render/view/index.js", () => ({ getViewOrientation: vi.fn() }));
vi.mock("../scenes/autotileGallery/AutotileGalleryScene.js", () => ({ AutotileGalleryScene: class {} }));
vi.mock("../scenes/dungeon/index.js", () => ({ DungeonScene: class {} }));
vi.mock("../scenes/editor/index.js", () => ({
  EditorScene: class {},
  setUpEditorLayout: vi.fn(() => ({ parentId: "editor-canvas", store: {} })),
}));
vi.mock("../scenes/GalleryScene.js", () => ({ GalleryScene: class {} }));
vi.mock("../scenes/HudScene.js", () => ({ HudScene: class {} }));
vi.mock("../scenes/title/index.js", () => ({ TitleScene: class {} }));
vi.mock("../scenes/title/connectForm.js", () => ({ loadStoredName: () => "Wren" }));
vi.mock("./mobileFullscreen.js", () => ({ installPhaserFullscreenRetry: harness.retry }));

describe("startPhaserRoute", () => {
  it("boots the editor at the full 20x20 gameplay-scale footprint", async () => {
    const { startPhaserRoute } = await import("./PhaserRoute.js");
    startPhaserRoute(new URLSearchParams("scene=editor"));
    expect(harness.configs.at(-1)).toMatchObject({
      parent: "editor-canvas",
      width: 960,
      height: 960,
    });
  });

  it("registers the created 2D canvas for post-resume fullscreen recovery", async () => {
    vi.stubGlobal("window", { location: new URL("http://localhost/") });
    const { startPhaserRoute } = await import("./PhaserRoute.js");
    startPhaserRoute(new URLSearchParams());
    expect(harness.retry).toHaveBeenCalledWith(harness.canvas);
    vi.unstubAllGlobals();
  });
});
