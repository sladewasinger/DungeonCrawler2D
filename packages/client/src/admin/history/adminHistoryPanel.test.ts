import { describe, expect, it } from "vitest";
import { commandResultMessage, historyResultLabel } from "./adminHistoryPanel.js";

describe("admin history presentation", () => {
  it("uses a concise result label without exposing command payloads", () => {
    expect(historyResultLabel({ ok: true })).toBe("Succeeded");
    expect(historyResultLabel({ ok: false, code: "destination_not_found" })).toBe("Rejected: destination_not_found");
  });

  it("keeps transient command results in the history area", () => {
    expect(commandResultMessage({ ok: false, code: "forbidden" })).toBe("Command rejected: forbidden");
  });
});
