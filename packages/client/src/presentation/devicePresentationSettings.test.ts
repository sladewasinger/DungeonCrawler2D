import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DEVICE_PRESENTATION_SETTINGS,
  loadDevicePresentationSettings,
  parseDevicePresentationSettings,
  saveDevicePresentationMode,
} from "./devicePresentationSettings.js";

describe("device presentation settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to automatic detection and rejects unknown schemas", () => {
    expect(parseDevicePresentationSettings(null))
      .toEqual(DEFAULT_DEVICE_PRESENTATION_SETTINGS);
    expect(parseDevicePresentationSettings({ schemaVersion: 2, mode: "constrained" }))
      .toEqual(DEFAULT_DEVICE_PRESENTATION_SETTINGS);
    expect(parseDevicePresentationSettings({ schemaVersion: 1, mode: "unknown" }).mode)
      .toBe("auto");
  });

  it("accepts the constrained override", () => {
    expect(parseDevicePresentationSettings({
      schemaVersion: 1,
      mode: "constrained",
    })).toEqual({ schemaVersion: 1, mode: "constrained" });
  });

  it("persists and reloads the selected mode", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    saveDevicePresentationMode("constrained");

    expect(loadDevicePresentationSettings().mode).toBe("constrained");
  });
});
