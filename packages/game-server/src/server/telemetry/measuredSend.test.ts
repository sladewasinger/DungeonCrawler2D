import { describe, expect, it } from "vitest";
import { outboundDiagnosticPayload } from "./measuredSend.js";

describe("outbound diagnostic redaction", () => {
  it("never records an issued admin continuation key", () => {
    const message = {
      type: "adminAuthResult" as const,
      ok: true,
      sessionKey: "a".repeat(43),
    };

    expect(outboundDiagnosticPayload(
      message,
      JSON.stringify(message),
    )).toBe('{"type":"adminCredential","redacted":true}');
  });
});
