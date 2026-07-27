/** Verifies client socket helpers account for accepted sends and decoded payloads. */
import { WireMetrics, encodeMessage } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { decodeMeasuredServerMessage } from "./measuredDecode.js";
import { sendMeasured } from "./measuredSend.js";

describe("measured client transport", () => {
  it("records message rates, bytes, codec cost, and queue high-water", () => {
    const metrics = new WireMetrics();
    const socket = {
      readyState: 1,
      bufferedAmount: 64,
      send: vi.fn(),
    } as unknown as WebSocket;
    sendMeasured(socket, { type: "ping", t: 4 }, metrics);
    const payload = encodeMessage({ type: "pong", t: 4 });
    expect(decodeMeasuredServerMessage(payload, 32, metrics)).toEqual({ type: "pong", t: 4 });

    const snapshot = metrics.snapshot(performance.now() + 1000);
    expect(socket.send).toHaveBeenCalledOnce();
    expect(snapshot.outboundMessagesPerSecond).toBeCloseTo(1, 1);
    expect(snapshot.inboundMessagesPerSecond).toBeCloseTo(1, 1);
    expect(snapshot.outboundBytesPerSecond).toBeGreaterThan(0);
    expect(snapshot.inboundBytesPerSecond).toBeGreaterThan(0);
    expect(snapshot.encodeMilliseconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.decodeMilliseconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.maximumQueueBytes).toBe(64);
  });

  it("rejects closed and throwing sockets without exceptions or metrics", () => {
    const metrics = new WireMetrics();
    const closed = {
      readyState: 3,
      bufferedAmount: 128,
      send: vi.fn(),
    } as unknown as WebSocket;
    const throwing = {
      readyState: 1,
      bufferedAmount: 256,
      send: vi.fn(() => {
        throw new Error("send rejected");
      }),
    } as unknown as WebSocket;

    let closedAccepted: boolean | undefined;
    let throwingAccepted: boolean | undefined;
    expect(() => {
      closedAccepted = sendMeasured(closed, { type: "ping", t: 1 }, metrics);
    }).not.toThrow();
    expect(() => {
      throwingAccepted = sendMeasured(throwing, { type: "ping", t: 2 }, metrics);
    }).not.toThrow();
    expect(closedAccepted).toBe(false);
    expect(throwingAccepted).toBe(false);
    expect(closed.send).not.toHaveBeenCalled();
    expect(throwing.send).toHaveBeenCalledOnce();
    const snapshot = metrics.snapshot(performance.now() + 1000);
    expect(snapshot.outboundMessagesPerSecond).toBe(0);
    expect(snapshot.outboundBytesPerSecond).toBe(0);
    expect(snapshot.encodeMilliseconds).toBe(0);
    expect(snapshot.maximumQueueBytes).toBe(0);
  });
});
