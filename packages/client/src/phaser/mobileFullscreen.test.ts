/** Ensures the Phaser adapter forwards its canvas to shared fullscreen recovery. */
import { describe, expect, it, vi } from "vitest";

const fullscreen = vi.hoisted(() => ({
  install: vi.fn(),
  retry: { dispose: vi.fn() },
}));

vi.mock("../ui/fullscreen/mobileFullscreen.js", () => ({
  installFullscreenResumeRetry: fullscreen.install,
}));

describe("installPhaserFullscreenRetry", () => {
  it("delegates its Phaser canvas to the shared retry installer", async () => {
    fullscreen.install.mockReturnValue(fullscreen.retry);
    const { installPhaserFullscreenRetry } = await import("./mobileFullscreen.js");
    const canvas = {} as HTMLElement;
    expect(installPhaserFullscreenRetry(canvas)).toBe(fullscreen.retry);
    expect(fullscreen.install).toHaveBeenCalledWith(canvas);
  });
});
