import { describe, expect, it } from "vitest";
import { AdminMapClickFocusGuard } from "./adminMapClickFocusGuard.js";

describe("admin map click focus guard", () => {
  it("consumes the click following an unfocused primary pointer down", () => {
    const guard = new AdminMapClickFocusGuard();

    guard.pointerDown({ button: 0, wasFocused: false });

    expect(guard.consumeClick()).toBe(true);
    expect(guard.consumeClick()).toBe(false);
  });

  it("consumes an unfocused right click before it can remove an entity", () => {
    const guard = new AdminMapClickFocusGuard();

    guard.pointerDown({ button: 2, wasFocused: false });

    expect(guard.consumeContextMenu()).toBe(true);
  });

  it("does not consume clicks from focused or non-map interactions", () => {
    const guard = new AdminMapClickFocusGuard();

    guard.pointerDown({ button: 0, wasFocused: true });
    expect(guard.consumeClick()).toBe(false);

    guard.pointerDown({ button: 1, wasFocused: false });
    expect(guard.consumeClick()).toBe(false);
  });
});
