import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS,
  parseExperimentalCorpNetSettings,
} from "./corpNetSettings.js";

describe("Experimental CorpNet settings", () => {
  it("defaults off and rejects malformed persisted values", () => {
    expect(parseExperimentalCorpNetSettings(null)).toEqual(
      DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS,
    );
    expect(parseExperimentalCorpNetSettings({ schemaVersion: 1, enabled: "yes" })).toEqual(
      DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS,
    );
  });

  it("accepts the explicit opt-in setting", () => {
    expect(parseExperimentalCorpNetSettings({ schemaVersion: 1, enabled: true }))
      .toEqual({ schemaVersion: 1, enabled: true });
  });
});
