import { describe, expect, it } from "vitest";
import { movementTraceDiagnosticsEnabled } from "./developmentMovementTrace.js";

describe("movement trace diagnostics flag", () => {
  it("stays disabled for ordinary development sessions", () => {
    expect(movementTraceDiagnosticsEnabled({ DEV: true })).toBe(false);
    expect(movementTraceDiagnosticsEnabled({
      DEV: true,
      VITE_ENABLE_MOVEMENT_TRACE: "0",
    })).toBe(false);
  });

  it("requires an explicit development-only opt in", () => {
    expect(movementTraceDiagnosticsEnabled({
      DEV: true,
      VITE_ENABLE_MOVEMENT_TRACE: "1",
    })).toBe(true);
    expect(movementTraceDiagnosticsEnabled({
      DEV: false,
      VITE_ENABLE_MOVEMENT_TRACE: "1",
    })).toBe(false);
  });
});
