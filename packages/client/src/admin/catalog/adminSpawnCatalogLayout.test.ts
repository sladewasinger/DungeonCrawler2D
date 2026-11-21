import { describe, expect, it } from "vitest";
import { ADMIN_CATALOG_LAYOUT } from "./adminSpawnCatalog.js";

describe("admin spawn catalog layout contract", () => {
  it("marks the palette as a full-width workspace row", () => {
    expect(ADMIN_CATALOG_LAYOUT).toBe("full-width");
  });
});
