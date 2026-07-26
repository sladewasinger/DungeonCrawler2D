import type { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import type { GameSim } from "../sim/index.js";
import { currentSocketOwnsPlayer } from "./socketAuthority.js";
import type { SocketMap } from "./types.js";

describe("socket authority", () => {
  it("invalidates a replaced transport immediately", () => {
    const previous = {} as WebSocket;
    const replacement = {} as WebSocket;
    const sockets: SocketMap = new Map([
      ["player", { ws: replacement, sim: {} as GameSim }],
    ]);

    expect(currentSocketOwnsPlayer(sockets, "player", previous)).toBe(false);
    expect(currentSocketOwnsPlayer(sockets, "player", replacement)).toBe(true);
  });
});
