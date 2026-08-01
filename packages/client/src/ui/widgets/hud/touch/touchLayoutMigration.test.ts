import { describe, expect, it } from "vitest";
import { migrateTouchButtonCluster } from "./touchLayoutMigration.js";

describe("legacy touch button layout migration", () => {
  it("expands the saved cluster placement into independent action controls", () => {
    const migrated = migrateTouchButtonCluster({ version: 1, widgets: { "touch-buttons": { anchor: "bottom-right", offset: { x: -20, y: -48 }, scale: 1.2 } } });
    expect(migrated.widgets["touch-buttons"]).toBeUndefined();
    expect(migrated.widgets["touch-attack"]).toMatchObject({ anchor: "bottom-right", scale: 1.2 });
    expect(migrated.widgets["touch-interact"]?.offset).not.toEqual(migrated.widgets["touch-attack"]?.offset);
  });
});
