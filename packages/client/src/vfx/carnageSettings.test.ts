import { describe, expect, it } from "vitest";
import {
  DEFAULT_CARNAGE_SETTINGS,
  parseCarnageSettings,
} from "./carnageSettings.js";

describe("carnage settings", () => {
  it("uses maximum-carnage defaults", () => {
    expect(parseCarnageSettings(null)).toEqual(DEFAULT_CARNAGE_SETTINGS);
  });

  it("clamps persisted limits and intensity", () => {
    expect(parseCarnageSettings({
      schemaVersion: 1,
      enabled: false,
      bloodEnabled: false,
      intensity: 99,
      streakLimit: -4,
      chunkLimit: 99,
    })).toMatchObject({
      enabled: false,
      bloodEnabled: false,
      intensity: 2,
      streakLimit: 0,
      chunkLimit: 12,
    });
  });
});
