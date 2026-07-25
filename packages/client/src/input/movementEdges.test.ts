import {
  decodeClientMessage,
  type BodyState,
  type World,
} from "@dc2d/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Connection } from "../net/connection.js";
import { readMoveInput } from "./keys.js";
import { bindKeyboardMovementEdges } from "./movementEdges.js";
import type { InputConnection, InputState } from "./state.js";

class FakeKey {
  isDown = false;
  private readonly listeners = new Map<string, Array<() => void>>();

  on(event: string, listener: () => void): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  press(): void {
    this.isDown = true;
    for (const listener of this.listeners.get("down") ?? []) listener();
  }

  release(): void {
    this.isDown = false;
    for (const listener of this.listeners.get("up") ?? []) listener();
  }
}

function createInputState(w: FakeKey): InputState {
  const unused = new FakeKey();
  return {
    keys: {
      W: w,
      A: unused,
      S: unused,
      D: unused,
      SPACE: unused,
      G: unused,
      E: unused,
      R: unused,
      C: unused,
      F: unused,
      ESC: unused,
      SHIFT: unused,
      I: unused,
      TAB: unused,
      ENTER: unused,
      O: unused,
      K: unused,
    },
    cursors: {
      left: unused,
      right: unused,
      up: unused,
      down: unused,
      space: unused,
      shift: unused,
    },
    nextSwingAt: 0,
    selectedSlot: null,
  } as unknown as InputState;
}

function connectedConnection(send: (payload: string) => void): Connection {
  const connection = new Connection("ws://example.test", "Tester", "client-1");
  connection.world = {} as World;
  connection.body = {} as BodyState;
  connection.status = "connected";
  connection.hasReceivedSnapshot = true;
  connection.hp = 1;
  connection.ws = {
    readyState: 1,
    bufferedAmount: 0,
    send,
  } as unknown as WebSocket;
  return connection;
}

afterEach(() => vi.unstubAllGlobals());

describe("keyboard movement edges", () => {
  it("writes key-down and key-up to the WebSocket synchronously without a fixed tick", () => {
    vi.stubGlobal("document", { activeElement: null });
    vi.stubGlobal("HTMLInputElement", class {});
    vi.stubGlobal("HTMLTextAreaElement", class {});
    const wireSend = vi.fn<(payload: string) => void>();
    const connection = connectedConnection(wireSend);
    const inputConnection = connection as unknown as InputConnection;
    const w = new FakeKey();
    const state = createInputState(w);
    bindKeyboardMovementEdges(
      state,
      () => connection.sendInputEdge(readMoveInput(state, inputConnection)),
    );

    w.press();

    expect(wireSend).toHaveBeenCalledTimes(1);
    expect(decodeClientMessage(wireSend.mock.calls[0]![0])).toMatchObject({
      type: "input",
      seq: 1,
      moveX: 0,
      moveY: -1,
    });

    w.release();

    expect(wireSend).toHaveBeenCalledTimes(2);
    expect(decodeClientMessage(wireSend.mock.calls[1]![0])).toMatchObject({
      type: "input",
      seq: 2,
      moveX: 0,
      moveY: 0,
    });
  });
});
