import { describe, expect, it, vi } from "vitest";
import { bindThrowAimKey } from "./keyboard.js";

type KeyEdge = "down" | "up";

const fakeKey = () => {
  const listeners = new Map<KeyEdge, () => void>();
  return {
    key: {
      on: (edge: KeyEdge, listener: () => void) => listeners.set(edge, listener),
    },
    emit: (edge: KeyEdge) => listeners.get(edge)?.(),
  };
};

describe("G throw-aim keyboard binding", () => {
  it("starts aim on key-down and delegates throwing eligibility on key-up", () => {
    const source = fakeKey();
    const onStart = vi.fn();
    const onRelease = vi.fn();
    bindThrowAimKey({
      key: source.key as never,
      blocked: () => false,
      onStart,
      onRelease,
    });

    source.emit("down");
    expect(onStart).toHaveBeenCalledOnce();
    expect(onRelease).not.toHaveBeenCalled();
    source.emit("up");
    expect(onRelease).toHaveBeenCalledWith(true);
  });

  it("still forwards a blocked release so held aim state can cancel", () => {
    const source = fakeKey();
    let blocked = false;
    const onRelease = vi.fn();
    bindThrowAimKey({
      key: source.key as never,
      blocked: () => blocked,
      onStart: vi.fn(),
      onRelease,
    });

    source.emit("down");
    blocked = true;
    source.emit("up");
    expect(onRelease).toHaveBeenCalledWith(false);
  });
});
