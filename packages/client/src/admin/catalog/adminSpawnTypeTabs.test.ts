import { describe, expect, it } from "vitest";
import { ADMIN_SPAWN_TAB_COLUMNS, ADMIN_SPAWN_TYPES } from "./adminSpawnTypeTabs.js";

describe("admin spawn type tabs", () => {
  it("defines four distinct categories for the tab row", () => {
    expect(ADMIN_SPAWN_TYPES).toEqual(["enemy", "item", "weapon", "pet"]);
    expect(new Set(ADMIN_SPAWN_TYPES).size).toBe(4);
    expect(ADMIN_SPAWN_TAB_COLUMNS).toBe(4);
  });
});
