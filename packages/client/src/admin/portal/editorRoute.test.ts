import { describe, expect, it, vi } from "vitest";

const startPhaserRoute = vi.hoisted(() => vi.fn());
vi.mock("../../phaser/EditorPhaserRoute.js", () => ({ startEditorPhaserRoute: startPhaserRoute }));

describe("standalone editor route", () => {
  it("starts the unauthenticated editor scene without constructing AdminPage", async () => {
    vi.stubGlobal("window", { location: { pathname: "/editor", hostname: "localhost", search: "?seed=17" } });
    const { startEditorRoute } = await import("./editorRoute.js");

    startEditorRoute();

    expect(startPhaserRoute).toHaveBeenCalledWith();
    vi.unstubAllGlobals();
  });

  it("does not start from a non-loopback host", async () => {
    startPhaserRoute.mockClear();
    vi.stubGlobal("window", { location: { pathname: "/editor", hostname: "example.test", search: "" } });
    const { startEditorRoute } = await import("./editorRoute.js");

    startEditorRoute();

    expect(startPhaserRoute).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
