/** Verifies the Three route registers its root with the shared retry path. */
import { afterEach, describe, expect, it, vi } from "vitest";

const fullscreen = vi.hoisted(() => {
  const retry = { dispose: vi.fn() };
  return { enter: vi.fn(), install: vi.fn(() => retry), retry };
});

vi.mock("../../input/touchDetect.js", () => ({ isTouchDevice: () => true }));
vi.mock("../../ui/fullscreen/mobileFullscreen.js", () => ({
  canEnterFullscreen: () => true,
  enterFullscreenLandscape: fullscreen.enter,
  installFullscreenResumeRetry: fullscreen.install,
  isFullscreenActive: () => false,
}));

function fakeDocument() {
  const button = {
    type: "",
    textContent: "",
    hidden: false,
    style: { cssText: "" },
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    remove: vi.fn(),
  };
  return {
    button,
    createElement: () => button,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("enableMobileDisplay", () => {
  it("wires retry and deterministically removes its display listeners", async () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", { location: new URL("http://localhost/?touch=1"), navigator: { maxTouchPoints: 1 } });
    vi.stubGlobal("screen", { orientation: { lock: vi.fn() } });
    const root = { append: vi.fn() } as unknown as HTMLElement;
    const { enableMobileDisplay } = await import("./ThreeMobileDisplay.js");
    const release = enableMobileDisplay(root);
    expect(fullscreen.install).toHaveBeenCalledWith({ target: root });
    release();
    expect(fullscreen.retry.dispose).toHaveBeenCalledOnce();
    expect(doc.removeEventListener).toHaveBeenCalledWith("fullscreenchange", expect.any(Function));
    expect(doc.removeEventListener).toHaveBeenCalledWith("webkitfullscreenchange", expect.any(Function));
    expect(doc.button.remove).toHaveBeenCalledOnce();
  });
});
