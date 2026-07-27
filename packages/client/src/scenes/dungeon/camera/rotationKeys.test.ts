import { afterEach, describe, expect, it, vi } from "vitest";
import { bindRotationKeys, rotationDirectionForKey } from "./rotationKeys.js";

describe("rotationDirectionForKey", () => {
  it("maps only the live Q/X camera controls to one discrete turn", () => {
    expect(rotationDirectionForKey("KeyQ")).toBe(-1);
    expect(rotationDirectionForKey("KeyX")).toBe(1);
    expect(rotationDirectionForKey("KeyE")).toBeNull();
    expect(rotationDirectionForKey("Digit1")).toBeNull();
  });
});

describe("bindRotationKeys", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("receives the production window key route, respects text focus, and unregisters on scene shutdown", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, removeEventListener });
    vi.stubGlobal("document", { activeElement: null });
    vi.stubGlobal("HTMLInputElement", class HTMLInputElement {});
    vi.stubGlobal("HTMLTextAreaElement", class HTMLTextAreaElement {});

    let dispose: (() => void) | undefined;
    const scene = {
      events: {
        once: vi.fn((_event: string, callback: () => void) => {
          dispose = callback;
        }),
      },
    };
    const request = vi.fn();
    bindRotationKeys(
      scene as never,
      { request } as never,
    );

    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    const handler = addEventListener.mock.calls[0]?.[1] as (event: KeyboardEvent) => void;
    const preventDefault = vi.fn();
    handler({ code: "KeyQ", preventDefault } as unknown as KeyboardEvent);
    expect(request).toHaveBeenCalledWith(-1);
    expect(preventDefault).toHaveBeenCalledOnce();

    vi.stubGlobal("document", { activeElement: new HTMLInputElement() });
    handler({ code: "KeyX", preventDefault } as unknown as KeyboardEvent);
    expect(request).not.toHaveBeenCalledWith(1);

    dispose?.();
    expect(removeEventListener).toHaveBeenCalledWith("keydown", handler, true);
  });
});
