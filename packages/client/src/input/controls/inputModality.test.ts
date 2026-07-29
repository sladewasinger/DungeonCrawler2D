import { describe, expect, it, vi } from "vitest";
import {
  InputModalityStore,
  MOUSE_AFTER_TOUCH_HYSTERESIS_MS,
  MOUSE_DEMOTION_CONFIRM_MS,
  initialInputModality,
} from "./inputModality.js";

const fakeWindow = (
  search = "",
  maxTouchPoints = 0,
): Window => ({
  location: { search },
  navigator: { maxTouchPoints },
} as Window);

describe("InputModalityStore", () => {
  it("promotes on touch and emits each shared transition exactly once", () => {
    const store = new InputModalityStore("desktop");
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);

    store.noteTouch(100);
    store.noteTouch(120);

    expect(store.current).toBe("touch");
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("ignores compatibility and stray mouse input, then accepts confirmed mouse input", () => {
    const store = new InputModalityStore("desktop");
    store.noteTouch(100);
    store.noteDesktop("mouse", 100 + MOUSE_AFTER_TOUCH_HYSTERESIS_MS - 1);
    expect(store.current).toBe("touch");

    store.noteDesktop("mouse", 100 + MOUSE_AFTER_TOUCH_HYSTERESIS_MS);
    expect(store.current).toBe("touch");
    store.noteDesktop(
      "mouse",
      100 + MOUSE_AFTER_TOUCH_HYSTERESIS_MS + MOUSE_DEMOTION_CONFIRM_MS,
    );
    expect(store.current).toBe("desktop");
  });

  it("lets keyboard intent demote immediately", () => {
    const store = new InputModalityStore("touch");
    store.noteTouch(100);
    store.noteDesktop("keyboard", 101);
    expect(store.current).toBe("desktop");
  });

  it("treats touch capability and ?touch=1 as initial hints, not locks", () => {
    expect(initialInputModality(fakeWindow("", 5))).toBe("touch");
    expect(initialInputModality(fakeWindow("?touch=1"))).toBe("touch");
    const store = new InputModalityStore(
      initialInputModality(fakeWindow("?touch=1")),
    );
    store.noteDesktop("keyboard", 10);
    expect(store.current).toBe("desktop");
  });

  it("removes a subscriber cleanly", () => {
    const store = new InputModalityStore("desktop");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.noteTouch(10);
    expect(listener).not.toHaveBeenCalled();
  });
});
