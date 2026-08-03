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
const TEST_URL = "http://localhost/";

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
vi.mock("../boot/PreloadScene.js", () => ({
  PreloadScene: class {
    constructor(readonly startupScene?: string) {}
  },
}));
vi.mock("../boot/versionRefreshOverlay.js", () => ({ bindVersionRefreshOverlay: vi.fn() }));
vi.mock("../buildInfo.js", () => ({ BUILD_SHA: "test" }));
vi.mock("../net/connection/connection.js", () => ({ Connection: class {} }));
vi.mock("../net/auth/identity.js", () => ({ persistentClientId: () => "client" }));
vi.mock("../net/connection/url.js", () => ({ resolveWsUrl: () => "ws://test" }));
vi.mock("../render/view/index.js", () => ({ getViewOrientation: vi.fn() }));
vi.mock("../scenes/dungeon/orchestration/index.js", () => ({ DungeonScene: class {} }));
vi.mock("../scenes/HudScene.js", () => ({ HudScene: class {} }));
vi.mock("../scenes/title/index.js", () => ({ TitleScene: class {} }));
vi.mock("../scenes/title/connectForm.js", () => ({ loadStoredName: () => "Wren" }));
vi.mock("../scenes/testbench/characterVfxTestbench.js", () => ({ CharacterVfxTestbench: class {} }));
vi.mock("./mobileFullscreen.js", () => ({ installPhaserFullscreenRetry: harness.retry }));

describe("startPhaserRoute", () => {
  it("does not let the removed query editor mode replace the game route", async () => {
    vi.stubGlobal("window", { location: new URL(TEST_URL) });
    const { startPhaserRoute } = await import("./PhaserRoute.js");
    startPhaserRoute(new URLSearchParams("scene=editor"));
    expect(harness.configs.at(-1)).toMatchObject({
      parent: "app",
    });
    vi.unstubAllGlobals();
  });

  it("registers the created 2D canvas for post-resume fullscreen recovery", async () => {
    vi.stubGlobal("window", { location: new URL(TEST_URL) });
    const { startPhaserRoute } = await import("./PhaserRoute.js");
    startPhaserRoute(new URLSearchParams());
    expect(harness.retry).toHaveBeenCalledWith(harness.canvas);
    vi.unstubAllGlobals();
  });

  it("keeps the default route title-bound without a testbench startup override", async () => {
    vi.stubGlobal("window", { location: new URL(TEST_URL) });
    const { startPhaserRoute } = await import("./PhaserRoute.js");
    startPhaserRoute(new URLSearchParams());
    const config = harness.configs.at(-1);
    expect(config?.scene).toHaveLength(5);
    expect(config?.parent).toBe("app");
    vi.unstubAllGlobals();
  });
});
