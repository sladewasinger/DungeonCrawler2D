import { describe, expect, it } from "vitest";
import {
  DEFAULT_CARNAGE_SETTINGS,
  parseCarnageSettings,
} from "./carnageSettings.js";

describe("carnage settings", () => {
  it("enables carnage with full blood-drop intensity by default", () => {
    expect(parseCarnageSettings(null)).toEqual(DEFAULT_CARNAGE_SETTINGS);
    expect(DEFAULT_CARNAGE_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_CARNAGE_SETTINGS.bloodEnabled).toBe(true);
    expect(DEFAULT_CARNAGE_SETTINGS.bloodDropIntensity).toBe(1);
  });

  it.each([false, true])(
    "preserves an explicit persisted enabled=%s preference",
    (enabled) => {
      expect(parseCarnageSettings({
        ...DEFAULT_CARNAGE_SETTINGS,
        enabled,
      }).enabled).toBe(enabled);
    },
  );

  it("clamps persisted limits and intensities", () => {
    expect(parseCarnageSettings({
      schemaVersion: 1,
      enabled: false,
      bloodEnabled: false,
      bloodDropIntensity: -4,
      intensity: 99,
      streakLimit: -4,
      chunkLimit: 99,
    })).toMatchObject({
      enabled: false,
      bloodEnabled: false,
      bloodDropIntensity: 0,
      intensity: 2,
      streakLimit: 0,
      chunkLimit: 12,
    });
  });

  it("migrates existing saved settings without discarding them", () => {
    expect(parseCarnageSettings({
      schemaVersion: 1,
      enabled: false,
      bloodEnabled: true,
      intensity: 0.75,
      streakLimit: 3,
      chunkLimit: 2,
    })).toMatchObject({
      enabled: false,
      bloodEnabled: true,
      bloodDropIntensity: 1,
      intensity: 0.75,
      streakLimit: 3,
      chunkLimit: 2,
    });
  });
});
