import { describe, expect, it } from "vitest";
import { fpsColor, nextTelemetryVisible, pingColor } from "./connectionStatus.js";

describe("nextTelemetryVisible ([F3] toggle)", () => {
  it("flips hidden -> shown -> hidden", () => {
    expect(nextTelemetryVisible(false)).toBe(true);
    expect(nextTelemetryVisible(true)).toBe(false);
  });
});

describe("pingColor", () => {
  it("reads disconnected as neutral-gray regardless of the stale ping value", () => {
    expect(pingColor(9999, false)).toBe(0x494956);
  });

  it("thresholds good/ok/bad", () => {
    expect(pingColor(10, true)).toBe(0x3dd6c3);
    expect(pingColor(100, true)).toBe(0xffd23d);
    expect(pingColor(300, true)).toBe(0xe04a4a);
  });
});

describe("fpsColor", () => {
  it("thresholds good/ok/bad", () => {
    expect(fpsColor(60)).toBe(0x3dd6c3);
    expect(fpsColor(40)).toBe(0xffd23d);
    expect(fpsColor(10)).toBe(0xe04a4a);
  });
});
