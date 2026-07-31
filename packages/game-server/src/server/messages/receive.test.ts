import { describe, expect, it } from "vitest";
import { inboundDiagnosticPayload } from "./receive.js";

const REDACTED_CREDENTIAL = '{"type":"adminCredential","redacted":true}';

describe("inbound diagnostic redaction", () => {
  it("never records an admin token or an opaque continuation key", () => {
    expect(inboundDiagnosticPayload(
      '{"type":"adminAuth","token":"server-secret"}',
      "adminAuth",
    )).toBe(REDACTED_CREDENTIAL);
    expect(inboundDiagnosticPayload(
      '{"type":"adminResume","sessionKey":"opaque-key"}',
      "adminResume",
    )).toBe(REDACTED_CREDENTIAL);
  });

  it("redacts a malformed admin credential payload before the decoder rejects it", () => {
    expect(inboundDiagnosticPayload(
      '{"type":"adminResume","sessionKey":',
      undefined,
    )).toBe(REDACTED_CREDENTIAL);
  });
});
