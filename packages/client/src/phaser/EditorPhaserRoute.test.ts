import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ configs: [] as Record<string, unknown>[] }));

vi.mock("phaser", () => ({
  default: {
    AUTO: 1,
    Core: { Events: { DESTROY: "destroy" } },
    Game: class {
      readonly registry = { set: vi.fn() };
      readonly events = { once: vi.fn() };

      constructor(config: Record<string, unknown>) { harness.configs.push(config); }
    },
  },
}));
vi.mock("../boot/PreloadScene.js", () => ({
  PreloadScene: class { constructor(readonly startupScene?: string) {} },
}));
vi.mock("../render/view/index.js", () => ({ getViewOrientation: vi.fn() }));
vi.mock("../scenes/editor/index.js", () => ({
  EditorScene: class {},
  setUpEditorLayout: vi.fn(() => ({ parentId: "editor-canvas", dispose: vi.fn() })),
}));

describe("startEditorPhaserRoute", () => {
  it("starts EditorScene explicitly without a connection or title scene", async () => {
    const { startEditorPhaserRoute } = await import("./EditorPhaserRoute.js");
    vi.stubGlobal("window", { location: { search: "" } });

    startEditorPhaserRoute();

    const config = harness.configs.at(-1);
    const scenes = config?.scene as Array<{ readonly startupScene?: string }>;
    expect(config?.parent).toBe("editor-canvas");
    expect(scenes[0]?.startupScene).toBe("editor");
    expect(scenes).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});
