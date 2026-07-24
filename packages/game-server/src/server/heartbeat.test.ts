import { describe, expect, it, vi } from "vitest";
import { sweepHeartbeat } from "./heartbeat.js";

/** Transport heartbeat behavior without real sockets or wall-clock waits. */

describe("socket heartbeat", () => {
  it("pings responsive sockets and terminates one that misses a full interval", () => {
    const socket = { ping: vi.fn(), terminate: vi.fn() };
    const responsive = new Set([socket]);

    sweepHeartbeat([socket], responsive);
    expect(socket.ping).toHaveBeenCalledOnce();
    expect(socket.terminate).not.toHaveBeenCalled();

    sweepHeartbeat([socket], responsive);
    expect(socket.terminate).toHaveBeenCalledOnce();
  });

  it("keeps a socket alive when its pong marks it responsive again", () => {
    const socket = { ping: vi.fn(), terminate: vi.fn() };
    const responsive = new Set([socket]);

    sweepHeartbeat([socket], responsive);
    responsive.add(socket);
    sweepHeartbeat([socket], responsive);

    expect(socket.ping).toHaveBeenCalledTimes(2);
    expect(socket.terminate).not.toHaveBeenCalled();
  });
});
