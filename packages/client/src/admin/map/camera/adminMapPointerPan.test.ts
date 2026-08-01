import { describe, expect, it, vi } from "vitest";
import { AdminMapCanvasInteractions } from "./adminMapCanvasInteractions.js";

describe("admin map pointer panning", () => {
  it("captures and pans only the owned middle pointer", () => {
    const canvas = testCanvas();
    const eventTarget = new EventTarget();
    const pointerPan = vi.fn();
    const pointerPanStateChange = vi.fn();
    const interactions = interactionsFor(canvas, {
      eventTarget,
      pointerPan,
      pointerPanStateChange,
    });

    const down = pointerEvent("pointerdown", {
      button: 1, pointerId: 12, clientX: 10, clientY: 20,
    });
    canvas.dispatchEvent(down);
    canvas.dispatchEvent(pointerEvent("pointermove", { pointerId: 13, clientX: 40, clientY: 50 }));
    canvas.dispatchEvent(pointerEvent("pointermove", { pointerId: 12, clientX: 30, clientY: 5 }));
    canvas.dispatchEvent(pointerEvent("pointerup", { pointerId: 12 }));

    expect(down.defaultPrevented).toBe(true);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(12);
    expect(pointerPan).toHaveBeenCalledWith({ x: 20, y: -15 });
    expect(pointerPanStateChange).toHaveBeenNthCalledWith(1, true);
    expect(pointerPanStateChange).toHaveBeenNthCalledWith(2, false);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(12);
    interactions.dispose();
  });

  it.each(["pointercancel", "lostpointercapture"])("releases on %s", (releaseEvent) => {
    const canvas = testCanvas();
    const interactions = interactionsFor(canvas);

    canvas.dispatchEvent(pointerEvent("pointerdown", { button: 1, pointerId: 4 }));
    canvas.dispatchEvent(pointerEvent(releaseEvent, { pointerId: 4 }));
    canvas.dispatchEvent(pointerEvent("pointermove", { pointerId: 4, clientX: 20 }));

    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(4);
    interactions.dispose();
  });

  it("releases on blur and dispose", () => {
    const canvas = testCanvas();
    const eventTarget = new EventTarget();
    const stateChange = vi.fn();
    const interactions = interactionsFor(canvas, { eventTarget, pointerPanStateChange: stateChange });

    canvas.dispatchEvent(pointerEvent("pointerdown", { button: 1, pointerId: 5 }));
    eventTarget.dispatchEvent(new Event("blur"));
    canvas.dispatchEvent(pointerEvent("pointerdown", { button: 1, pointerId: 6 }));
    interactions.dispose();

    expect(stateChange).toHaveBeenCalledWith(false);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(5);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(6);
  });

  it("never places or removes from a middle drag, then accepts next actions", () => {
    const canvas = testCanvas();
    const click = vi.fn();
    const contextMenu = vi.fn();
    const interactions = interactionsFor(canvas, { click, contextMenu });

    canvas.dispatchEvent(pointerEvent("pointerdown", { button: 1, pointerId: 7 }));
    canvas.dispatchEvent(pointerEvent("pointermove", { pointerId: 7, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent("pointerup", { pointerId: 7 }));
    canvas.dispatchEvent(pointerEvent("click", { button: 1 }));
    canvas.dispatchEvent(pointerEvent("auxclick", { button: 1 }));
    canvas.dispatchEvent(pointerEvent("contextmenu", { button: 1 }));

    expect(click).not.toHaveBeenCalled();
    expect(contextMenu).not.toHaveBeenCalled();
    canvas.dispatchEvent(pointerEvent("click", { button: 0 }));
    canvas.dispatchEvent(pointerEvent("contextmenu", { button: 2 }));
    expect(click).toHaveBeenCalledOnce();
    expect(contextMenu).toHaveBeenCalledOnce();
    interactions.dispose();
  });
});

function interactionsFor(
  canvas: HTMLCanvasElement,
  overrides: Partial<ConstructorParameters<typeof AdminMapCanvasInteractions>[0]> = {},
): AdminMapCanvasInteractions {
  return new AdminMapCanvasInteractions({
    canvas,
    click: vi.fn(),
    contextMenu: vi.fn(),
    mouseMove: vi.fn(),
    mouseLeave: vi.fn(),
    pointerDown: vi.fn(),
    ...overrides,
  });
}

function testCanvas(): HTMLCanvasElement {
  return Object.assign(new EventTarget(), {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  }) as unknown as HTMLCanvasElement;
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
