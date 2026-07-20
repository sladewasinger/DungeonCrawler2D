// Loader key stability: every tile-pack sheet gets one deterministic, collision-free key
// and a path that actually matches where the asset-foundry lane copied its file.
import { describe, expect, it } from "vitest";
import { tileCatalog } from "@dc2d/content";
import { tilePackFrameIndex, tilePackSheetKey, tilePackSheetSpecs } from "./tilePackManifest.js";

describe("tilePackSheetKey", () => {
  it("is stable and namespaced by pack + sheet id", () => {
    expect(tilePackSheetKey("medieval-sewer", "tile-b-04")).toBe("tilepack:medieval-sewer:tile-b-04");
  });
});

describe("tilePackSheetSpecs", () => {
  const specs = tilePackSheetSpecs(tileCatalog);

  it("produces one spec per sheet across every pack, all keys unique", () => {
    const expectedCount = Object.values(tileCatalog.packs).reduce(
      (sum, pack) => sum + Object.keys(pack.sheets).length,
      0,
    );
    expect(specs).toHaveLength(expectedCount);
    expect(new Set(specs.map((s) => s.key)).size).toBe(specs.length);
  });

  it("every path points at packages/client/public/assets/packs/<pack>/<file>", () => {
    for (const spec of specs) {
      expect(spec.path).toMatch(/^assets\/packs\/[a-z0-9-]+\/.+\.png$/);
    }
  });

  it("uses the catalog's 48px tile size for every frame", () => {
    for (const spec of specs) {
      expect(spec.frameWidth).toBe(48);
      expect(spec.frameHeight).toBe(48);
    }
  });
});

describe("tilePackFrameIndex", () => {
  it("computes row-major frame index within a sheet", () => {
    expect(tilePackFrameIndex({ sheet: "s", col: 0, row: 0, w: 1, h: 1, label: "x" }, 16)).toBe(0);
    expect(tilePackFrameIndex({ sheet: "s", col: 3, row: 2, w: 1, h: 1, label: "x" }, 16)).toBe(35);
  });
});
