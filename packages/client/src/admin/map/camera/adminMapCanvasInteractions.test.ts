import { describe, expect, it, vi } from "vitest";
import { AdminMapCanvasInteractions } from "./adminMapCanvasInteractions.js";

describe("admin map canvas interaction lifecycle", () => {
  it("stops delivering pointer events after disposal", () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    const callbacks = {
      click: vi.fn(),
      contextMenu: vi.fn(),
      mouseMove: vi.fn(),
      mouseLeave: vi.fn(),
      pointerDown: vi.fn(),
    };
    const interactions = new AdminMapCanvasInteractions({ canvas, ...callbacks });

    dispatchPointerEvents(canvas);
    interactions.dispose();
    dispatchPointerEvents(canvas);

    for (const callback of Object.values(callbacks)) expect(callback).toHaveBeenCalledOnce();
  });
});

function dispatchPointerEvents(canvas: HTMLCanvasElement): void {
  for (const type of ["click", "contextmenu", "mousemove", "mouseleave", "pointerdown"]) {
    canvas.dispatchEvent(new Event(type));
  }
}
