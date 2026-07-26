import { describe, expect, it, vi } from "vitest";
import { bindTitleHintLayout } from "./controlsHint.js";

describe("bindTitleHintLayout", () => {
  it("lays out initially, follows resize in both directions, and removes its listener", () => {
    let resizeListener: (() => void) | undefined;
    const viewport = {
      innerWidth: 1280,
      innerHeight: 800,
      addEventListener: vi.fn((_type: "resize", listener: () => void) => {
        resizeListener = listener;
      }),
      removeEventListener: vi.fn(),
    };
    const apply = vi.fn();

    const dispose = bindTitleHintLayout(viewport, apply);
    expect(apply).toHaveBeenLastCalledWith(1280, 800);

    viewport.innerWidth = 844;
    viewport.innerHeight = 390;
    resizeListener?.();
    expect(apply).toHaveBeenLastCalledWith(844, 390);

    viewport.innerWidth = 900;
    viewport.innerHeight = 760;
    resizeListener?.();
    expect(apply).toHaveBeenLastCalledWith(900, 760);

    dispose();
    expect(viewport.removeEventListener).toHaveBeenCalledWith("resize", resizeListener);
  });
});
