import { describe, expect, it, vi } from "vitest";
import { KeyboardThrowAim } from "./keyboardThrowAim.js";

describe("keyboard throw aim lifecycle", () => {
  it("does not throw on key-down and throws once on release", () => {
    const throwNow = vi.fn();
    const aim = new KeyboardThrowAim();
    aim.press({ throwableSelected: true, allowDebug: false, onDebug: vi.fn() });
    expect(aim.active()).toBe(true);
    expect(throwNow).not.toHaveBeenCalled();
    aim.release({ allowThrow: true, onThrow: throwNow });
    expect(throwNow).toHaveBeenCalledOnce();
    expect(aim.active()).toBe(false);
  });

  it("supports a tap and ignores repeated down or release edges", () => {
    const throwNow = vi.fn();
    const aim = new KeyboardThrowAim();
    const press = { throwableSelected: true, allowDebug: false, onDebug: vi.fn() };
    aim.press(press);
    aim.press(press);
    aim.release({ allowThrow: true, onThrow: throwNow });
    aim.release({ allowThrow: true, onThrow: throwNow });
    expect(throwNow).toHaveBeenCalledOnce();
  });

  it("cancels without throwing when gameplay becomes blocked", () => {
    const throwNow = vi.fn();
    const aim = new KeyboardThrowAim();
    aim.press({ throwableSelected: true, allowDebug: false, onDebug: vi.fn() });
    aim.release({ allowThrow: false, onThrow: throwNow });
    expect(throwNow).not.toHaveBeenCalled();
    expect(aim.active()).toBe(false);
  });
});
