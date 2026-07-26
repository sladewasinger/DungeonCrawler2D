import { World } from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ThreeTouchControls.js", () => ({
  ThreeTouchControls: class {
    read() {
      return {
        forward: 0, right: 0, jump: false, run: false, block: false,
        attack: false, interactPressed: false, interactHeld: false,
        throwItem: false, yaw: 0, pitch: 0,
      };
    }
    consumeJumpPress() { return false; }
    reset() {}
    dispose() {}
  },
}));

import { ThreeActionController } from "./ThreeActionController.js";
import { ThreeInput } from "./ThreeInput.js";

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<(event: object) => void>>();

  addEventListener(type: string, listener: (event: object) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: object) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: object): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Three respawn production path", () => {
  it("drives the window KeyE listener through sampling and action polling", () => {
    const win = new FakeEventTarget();
    const doc = new FakeEventTarget() as FakeEventTarget & {
      pointerLockElement: unknown;
    };
    doc.pointerLockElement = null;
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("HTMLInputElement", class {});
    vi.stubGlobal("HTMLTextAreaElement", class {});
    vi.stubGlobal("Element", class {});
    const canvas = new FakeEventTarget() as unknown as HTMLCanvasElement;
    const input = new ThreeInput({} as HTMLElement, canvas);
    const conn = {
      dead: true,
      respawnNow: vi.fn(),
    } as unknown as Connection;
    const actions = new ThreeActionController(conn);
    const world = new World(1, 1);
    const now = vi.spyOn(performance, "now");
    const keyEvent = {
      code: "KeyE",
      target: null,
      preventDefault: vi.fn(),
    };

    now.mockReturnValue(0);
    win.dispatch("keydown", keyEvent);
    actions.publish(world, input.sample(0));
    now.mockReturnValue(1_500);
    actions.publish(world, input.sample(0));
    expect(actions.respawnHoldProgress()).toBe(0.5);

    now.mockReturnValue(3_000);
    actions.publish(world, input.sample(0));
    actions.publish(world, input.sample(0));
    expect(conn.respawnNow).toHaveBeenCalledOnce();

    win.dispatch("keyup", keyEvent);
    input.dispose();
  });
});
