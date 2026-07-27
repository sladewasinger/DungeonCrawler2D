import { describe, expect, it } from "vitest";
import { stashRowViews } from "./stashRows.js";

const nameOf = (id: string) => ({ rag: "Rag", sword: "Rusty Sword" })[id] ?? id;

describe("stashRowViews", () => {
  it("tags each row with its source-array index, unsorted", () => {
    const rows = stashRowViews([{ item: "sword", qty: 1 }, { item: "rag", qty: 6 }], nameOf);
    expect(rows).toEqual([
      { index: 0, itemId: "sword", name: "Rusty Sword", qty: 1 },
      { index: 1, itemId: "rag", name: "Rag", qty: 6 },
    ]);
  });

  it("handles an empty list", () => {
    expect(stashRowViews([], nameOf)).toEqual([]);
  });

  it("falls back to the raw id for an unknown item", () => {
    const rows = stashRowViews([{ item: "mystery", qty: 2 }], nameOf);
    expect(rows[0]!.name).toBe("mystery");
  });
});
