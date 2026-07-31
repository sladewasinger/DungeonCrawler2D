import { describe, expect, it } from "vitest";
import { serverErrorRecord } from "./structuredServerLog.js";

describe("serverErrorRecord", () => {
  it("keeps useful stack frames while excluding the raw error headline", () => {
    const untrustedMessage = "message from an untrusted payload";
    const error = new Error(untrustedMessage);
    error.stack = [
      `Error: ${untrustedMessage}`,
      "    at authoritativeStep (server.ts:10:2)",
      "    at nextTick (loop.ts:8:4)",
    ].join("\n");

    const record = serverErrorRecord("tick", error);

    expect(record).toMatchObject({
      level: "error",
      eventType: "server_error",
      source: "tick",
      errorName: "Error",
      message: untrustedMessage,
    });
    expect(record.stack).toContain("authoritativeStep");
    expect(record.stack).not.toContain(untrustedMessage);
  });

  it("redacts an error that contains a raw wire payload", () => {
    const record = serverErrorRecord(
      "decode",
      new Error('decode failure: {"type":"chat","text":"do not log this"}'),
    );

    expect(record.message).toBe("redacted_error_message");
    expect(record.stack).not.toContain("do not log this");
  });
});
