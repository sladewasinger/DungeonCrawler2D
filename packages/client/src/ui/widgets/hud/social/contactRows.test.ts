import { describe, expect, it } from "vitest";
import { contactRowViews } from "./contactRows.js";

describe("contact rows", () => {
  it("sorts online contacts first, alphabetical within each group", () => {
    const rows = contactRowViews([
      { name: "Zed", online: false },
      { name: "Wren", online: true },
      { name: "Ash", online: false },
      { name: "Rex", online: true },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Rex", "Wren", "Ash", "Zed"]);
    expect(rows.map((r) => r.statusLabel)).toEqual(["online", "online", "offline", "offline"]);
  });

  it("handles an empty contact list", () => {
    expect(contactRowViews([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { name: "B", online: false },
      { name: "A", online: true },
    ];
    contactRowViews(input);
    expect(input[0]!.name).toBe("B");
  });
});
