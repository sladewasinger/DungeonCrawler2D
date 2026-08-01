import { describe, expect, it, vi } from "vitest";
import { AdminMapCanvasInteractions } from "./adminMapCanvasInteractions.js";

describe("admin map canvas interactions", () => {
  it("stops delivering pointer events after disposal", () => {
    const canvas = testCanvas();
    const callbacks = interactionCallbacks();
    const interactions = new AdminMapCanvasInteractions({ canvas, ...callbacks });

    dispatchPointerEvents(canvas);
    interactions.dispose();
    dispatchPointerEvents(canvas);

    for (const callback of Object.values(callbacks)) expect(callback).toHaveBeenCalledOnce();
  });

  it("always suppresses the browser context menu, including on a miss", () => {
    const canvas = testCanvas();
    const contextMenu = vi.fn();
    const interactions = new AdminMapCanvasInteractions({
      canvas,
      contextMenu,
      click: vi.fn(),
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

  it("delivers the first unfocused placement and removal actions", () => {
    const canvas = testCanvas();
    const click = vi.fn();
    const contextMenu = vi.fn();
    const interactions = new AdminMapCanvasInteractions({
      canvas,
      click,
      contextMenu,
      mouseMove: vi.fn(),
      mouseLeave: vi.fn(),
      pointerDown: vi.fn(),
    });

    canvas.dispatchEvent(pointerEvent("pointerdown", { button: 0 }));
    canvas.dispatchEvent(pointerEvent("click", { button: 0 }));
    canvas.dispatchEvent(pointerEvent("pointerdown", { button: 2 }));
    canvas.dispatchEvent(pointerEvent("contextmenu", { button: 2 }));

    expect(click).toHaveBeenCalledOnce();
    expect(contextMenu).toHaveBeenCalledOnce();
    interactions.dispose();
  });
});

function interactionCallbacks() {
  return {
    click: vi.fn(),
    contextMenu: vi.fn(),
    mouseMove: vi.fn(),
    mouseLeave: vi.fn(),
    pointerDown: vi.fn(),
  };
}

function testCanvas(): HTMLCanvasElement {
  return Object.assign(new EventTarget(), {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  }) as unknown as HTMLCanvasElement;
}

function dispatchPointerEvents(canvas: HTMLCanvasElement): void {
  for (const type of ["click", "contextmenu", "auxclick", "mousemove", "mouseleave", "pointerdown"]) {
    canvas.dispatchEvent(new Event(type));
  }
}

interface PointerEventInput {
  readonly button?: number;
  readonly pointerId?: number;
  readonly clientX?: number;
  readonly clientY?: number;
}

function pointerEvent(type: string, input: PointerEventInput = {}): PointerEvent {
  return Object.assign(new Event(type, { cancelable: true }), {
    button: input.button ?? 0,
    pointerId: input.pointerId ?? 1,
    clientX: input.clientX ?? 0,
    clientY: input.clientY ?? 0,
  }) as PointerEvent;
}
