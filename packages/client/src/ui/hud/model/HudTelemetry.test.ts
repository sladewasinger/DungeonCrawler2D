import { describe, expect, it } from "vitest";
import { telemetryPerformanceLine } from "./HudTelemetry.js";

describe("telemetryPerformanceLine", () => {
  it("shows rounded FPS and connected latency", () => {
    expect(telemetryPerformanceLine({ connected: true, fps: 59.6, latencyMs: 41.5 }))
      .toBe("fps 60 · latency 42ms");
  });

  it("shows unavailable FPS and offline latency when disconnected", () => {
    expect(telemetryPerformanceLine({ connected: false, fps: undefined, latencyMs: 999 }))
      .toBe("fps — · latency offline");
  });
});
