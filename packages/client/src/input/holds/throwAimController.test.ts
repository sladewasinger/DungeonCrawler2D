import { describe, expect, it, vi } from "vitest";
import { ThrowAimController } from "./throwAimController.js";

describe("mobile throw aim", () => {
  it("begins only for an authoritative throwable and releases at the owner target", () => {
    const { aim, useSlot } = controller(true);
    aim.beginTouchAim({ id: 1, x: 20, y: 30 });
    expect(aim.preview()).toMatchObject({ slot: 0, targetX: 2, targetY: 3 });
    aim.moveTouchAim({ id: 2, x: 90, y: 90 });
    expect(aim.preview()).toMatchObject({ targetX: 2, targetY: 3 });
    aim.moveTouchAim({ id: 1, x: 40, y: 50 });
    expect(aim.preview()).toMatchObject({ targetX: 4, targetY: 5 });
    aim.releaseTouchAim(2, true);
    expect(useSlot).not.toHaveBeenCalled();
    aim.releaseTouchAim(1, true);
    expect(useSlot).toHaveBeenCalledWith(0, 4, 5);
    expect(aim.preview()).toBeNull();
  });

  it("never arms or throws when the selected entry is not throwable", () => {
    const { aim, useSlot } = controller(false);
    aim.beginTouchAim({ id: 1, x: 20, y: 30 });
    expect(aim.preview()).toBeNull();
    aim.releaseTouchAim(1, true);
    expect(useSlot).not.toHaveBeenCalled();
  });

  it("cancels the owner gesture without a throw or stuck preview", () => {
    const { aim, useSlot } = controller(true);
    aim.beginTouchAim({ id: 1, x: 20, y: 30 });
    aim.cancelTouchAim();
    expect(useSlot).not.toHaveBeenCalled();
    expect(aim.preview()).toBeNull();
  });
});

function controller(throwable: boolean) {
  const useSlot = vi.fn();
  const aim = new ThrowAimController({
    scene: { cameras: { main: { getWorldPoint: (x: number, y: number) => ({ x, y }) } }, input: { activePointer: { x: 0, y: 0 } } } as never,
    conn: { body: { x: 0, y: 0 }, hotbar: ["torch"], inventory: [], canAct: true, useSlot } as never,
    queries: { isThrowable: () => throwable } as never,
    state: { selectedSlot: 0 } as never,
    touch: { lastFacing: { x: 1, y: 0 } } as never,
    touchActive: () => true,
    tilePx: 10,
  });
  return { aim, useSlot };
}
