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

  it("always suppresses the browser context menu, including on a miss", () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    const contextMenu = vi.fn();
    const interactions = new AdminMapCanvasInteractions({
      canvas,
      click: vi.fn(),
      contextMenu,
      mouseMove: vi.fn(),
      mouseLeave: vi.fn(),
      pointerDown: vi.fn(),
    });
    const event = new Event("contextmenu", { cancelable: true });

    canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(contextMenu).toHaveBeenCalledOnce();
    interactions.dispose();
  });

  it("uses an unfocused first click only to focus the map", () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    const click = vi.fn();
    const pointerDown = vi.fn();
    let focused = false;
    const interactions = new AdminMapCanvasInteractions({
      canvas,
      click,
      contextMenu: vi.fn(),
      mouseMove: vi.fn(),
      mouseLeave: vi.fn(),
      pointerDown: () => {
        focused = true;
        pointerDown();
      },
      isFocused: () => focused,
    });

    canvas.dispatchEvent(pointerDownEvent(0));
    canvas.dispatchEvent(new Event("click", { cancelable: true }));
    canvas.dispatchEvent(pointerDownEvent(0));
    canvas.dispatchEvent(new Event("click", { cancelable: true }));

    expect(pointerDown).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledOnce();
    interactions.dispose();
  });

  it("uses an unfocused right click only to focus the map", () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    const contextMenu = vi.fn();
    let focused = false;
    const interactions = new AdminMapCanvasInteractions({
      canvas,
      click: vi.fn(),
      contextMenu,
      mouseMove: vi.fn(),
      mouseLeave: vi.fn(),
      pointerDown: () => {
        focused = true;
      },
      isFocused: () => focused,
    });

    canvas.dispatchEvent(pointerDownEvent(2));
    canvas.dispatchEvent(new Event("contextmenu", { cancelable: true }));

    expect(contextMenu).not.toHaveBeenCalled();
    interactions.dispose();
  });
});

function dispatchPointerEvents(canvas: HTMLCanvasElement): void {
  for (const type of ["click", "contextmenu", "mousemove", "mouseleave", "pointerdown"]) {
    canvas.dispatchEvent(new Event(type));
  }
}

function pointerDownEvent(button: number): PointerEvent {
  return Object.assign(new Event("pointerdown"), { button }) as PointerEvent;
}
