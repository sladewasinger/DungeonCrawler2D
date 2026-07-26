import { describe, expect, it, vi } from "vitest";
import { bindInteractKey } from "./interactKey.js";

describe("bindInteractKey", () => {
  it("publishes the first edge and ignores repeated keydown events until release", () => {
    const listeners = new Map<string, () => void>();
    const key = {
      on: vi.fn((event: "down" | "up", listener: () => void) => {
        listeners.set(event, listener);
      }),
    };
    const press = vi.fn();
    const release = vi.fn();

    bindInteractKey(key, press, release);
    listeners.get("down")?.();
    listeners.get("down")?.();
    listeners.get("down")?.();
    expect(press).toHaveBeenCalledTimes(1);

    listeners.get("up")?.();
    listeners.get("down")?.();
    expect(release).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledTimes(2);
  });
});
