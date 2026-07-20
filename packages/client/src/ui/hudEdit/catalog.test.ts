// Headless tests for edit-HUD's catalog row view-model — no Phaser/DOM.
import { describe, expect, it } from "vitest";
import type { WidgetDefinition, WidgetOverride } from "../widgets/state.js";
import { buildCatalogRows } from "./catalog.js";

function definition(id: string, defaultVisible: boolean): WidgetDefinition {
  return { id, defaultAnchor: "top-left", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible };
}

describe("buildCatalogRows", () => {
  it("falls back to each widget's shipped defaultVisible when there is no override", () => {
    const rows = buildCatalogRows([definition("health", true), definition("minimap", false)], () => undefined);
    expect(rows).toEqual([
      { id: "health", visible: true },
      { id: "minimap", visible: false },
    ]);
  });

  it("an override's visible field wins over the shipped default", () => {
    const overrides = new Map<string, WidgetOverride>([
      ["health", { visible: false }],
      ["minimap", { visible: true }],
    ]);
    const rows = buildCatalogRows(
      [definition("health", true), definition("minimap", false)],
      (id) => overrides.get(id),
    );
    expect(rows).toEqual([
      { id: "health", visible: false },
      { id: "minimap", visible: true },
    ]);
  });

  it("an override that only touches other fields (e.g. anchor) leaves visible at its default", () => {
    const overrides = new Map<string, WidgetOverride>([["health", { anchor: "center" }]]);
    const rows = buildCatalogRows([definition("health", true)], (id) => overrides.get(id));
    expect(rows).toEqual([{ id: "health", visible: true }]);
  });

  it("sorts rows by id regardless of registration order", () => {
    const rows = buildCatalogRows([definition("weapon", true), definition("chat", true), definition("buffs", true)], () => undefined);
    expect(rows.map((row) => row.id)).toEqual(["buffs", "chat", "weapon"]);
  });

  it("returns an empty list for an empty registry", () => {
    expect(buildCatalogRows([], () => undefined)).toEqual([]);
  });
});
