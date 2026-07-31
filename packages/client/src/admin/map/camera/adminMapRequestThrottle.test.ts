import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMapRequestThrottle } from "./adminMapRequestThrottle.js";

describe("admin map request throttling", () => {
  afterEach(() => vi.useRealTimers());

  it("coalesces held camera movement to four requests per second", () => {
    vi.useFakeTimers();
    let now = 0;
    const sent: number[] = [];
    const throttle = new AdminMapRequestThrottle({
      now: () => now,
      send: (request) => sent.push(request.center.x),
    });

    throttle.request(request(0.5));
    now = 30;
    throttle.request(request(1.5));
    now = 120;
    throttle.request(request(2.5));
    now = 249;
    throttle.request(request(3.5));
    now = 250;
    vi.advanceTimersByTime(250);

    expect(sent).toEqual([0.5, 3.5]);
  });

  it("stops a deferred request when the surface is disposed", () => {
    vi.useFakeTimers();
    let now = 0;
    const send = vi.fn();
    const throttle = new AdminMapRequestThrottle({ now: () => now, send });

    throttle.request(request(0.5));
    now = 1;
    throttle.request(request(1.5));
    throttle.dispose();
    vi.advanceTimersByTime(250);

    expect(send).toHaveBeenCalledTimes(1);
  });
});

function request(x: number) {
  return { level: "dungeon" as const, floor: 1, center: { x, y: 0.5 }, radius: 10 };
}
