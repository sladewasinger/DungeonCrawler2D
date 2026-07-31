import { describe, expect, it } from "vitest";
import { requireOperationalEventPepper } from "./operationalConfiguration.js";

describe("requireOperationalEventPepper", () => {
  it("allows local development without a DynamoDB table", () => {
    expect(requireOperationalEventPepper(undefined, undefined)).toBeUndefined();
  });

  it("fails closed when DynamoDB persistence lacks its peer-fingerprint secret", () => {
    expect(() => requireOperationalEventPepper("history", "")).toThrow("OPERATIONAL_EVENT_PEPPER");
  });

  it("returns the configured non-empty secret", () => {
    expect(requireOperationalEventPepper("history", "  persisted-secret  ")).toBe("persisted-secret");
  });
});
