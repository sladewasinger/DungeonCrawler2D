// Round-trip + cross-reference test: tileCatalog.json must validate against its own
// schema, every ref must point at a real sheet cell, and the schema must reject
// malformed data (asset-foundry lane, explicit-heights-reskin pivot).
import { describe, expect, it } from "vitest";
import catalog from "./tileCatalog.json" with { type: "json" };
import { parseTileCatalog, tileCatalogSchema, validateTileCatalogRefs } from "./tileCatalog.schema.js";

describe("tileCatalog.json / tileCatalogSchema", () => {
  it("parses the shipped tileCatalog.json unchanged", () => {
    const parsed = parseTileCatalog(catalog);
    expect(parsed).toEqual(catalog);
  });

  it("has no dangling sheet references or out-of-bounds rects", () => {
    const parsed = parseTileCatalog(catalog);
    expect(validateTileCatalogRefs(parsed)).toEqual([]);
  });

  it("covers all 7 packs named in assets/packs/", () => {
    const parsed = parseTileCatalog(catalog);
    expect(Object.keys(parsed.packs).sort()).toEqual(
      [
        "coc",
        "dragon-cave",
        "dwarf-volcano-underground-fortress",
        "goblin-cave",
        "goblin-mechanical-workshop",
        "haunted-amusement-park",
        "medieval-sewer",
      ].sort(),
    );
  });
});

function cloneCatalog(): { packs: Record<string, { stairs: unknown; floorVariants: unknown[] }> } {
  // JSON.parse/stringify, not structuredClone: this repo's tsconfig has no DOM/Node
  // globals in scope (types: []), and the source is plain JSON data anyway.
  return JSON.parse(JSON.stringify(catalog));
}

function medievalSewerOf(broken: { packs: Record<string, { stairs: unknown; floorVariants: unknown[] }> }) {
  const pack = broken.packs["medieval-sewer"];
  if (!pack) throw new Error("fixture missing medieval-sewer — test setup bug");
  return pack;
}

describe("tileCatalog.json / tileCatalogSchema mutation rejections", () => {
  it("rejects a pack missing a required category array", () => {
    const broken = cloneCatalog();
    delete medievalSewerOf(broken).stairs;
    expect(() => tileCatalogSchema.parse(broken)).toThrow();
  });

  it("rejects a ref naming a sheet the pack never declares", () => {
    const broken = cloneCatalog();
    medievalSewerOf(broken).floorVariants.push({
      sheet: "not-a-real-sheet",
      col: 0,
      row: 0,
      w: 1,
      h: 1,
      label: "bogus",
    });
    const parsed = parseTileCatalog(broken);
    expect(validateTileCatalogRefs(parsed).some((e) => e.includes("not-a-real-sheet"))).toBe(true);
  });

  it("rejects a rect that overruns its sheet's declared bounds", () => {
    const broken = cloneCatalog();
    medievalSewerOf(broken).floorVariants.push({
      sheet: "tile-b-01",
      col: 15,
      row: 15,
      w: 4,
      h: 4,
      label: "overrun",
    });
    const parsed = parseTileCatalog(broken);
    expect(validateTileCatalogRefs(parsed).some((e) => e.includes("overrun"))).toBe(true);
  });
});
