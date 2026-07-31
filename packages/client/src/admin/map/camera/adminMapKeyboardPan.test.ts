import { describe, expect, it, vi } from "vitest";
import { AdminMapKeyboardPan } from "./adminMapKeyboardPan.js";

describe("admin map keyboard panning", () => {
  it("ignores a keydown event with no key property", () => {
    const eventTarget = new EventTarget();
    const onPan = vi.fn();
    const keyboardPan = new AdminMapKeyboardPan({
      canvas: {} as HTMLCanvasElement,
      eventTarget,
      onPan,
    });

    expect(() => eventTarget.dispatchEvent(new Event("keydown"))).not.toThrow();
    expect(onPan).not.toHaveBeenCalled();
    keyboardPan.dispose();
  });
});
