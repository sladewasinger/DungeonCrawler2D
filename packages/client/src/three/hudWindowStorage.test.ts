import { describe, expect, it } from "vitest";
import { resolveWindowPosition } from "./HudWindowLayout.js";
import { migrateLegacyWindowLayout } from "./hudWindowStorage.js";

describe("HUD window storage migration", () => {
  it("converts legacy pixels into relative usable-area coordinates", () => {
    const migrated = migrateLegacyWindowLayout({
      anchor: "free",
      x: 1000,
      y: 270,
      width: 280,
      height: 180,
      z: 12,
      visible: true,
    }, { width: 1280, height: 720 });

    expect(migrated).toMatchObject({ xRatio: 1, yRatio: 0.5 });
    expect(resolveWindowPosition(
      migrated,
      { width: 280, height: 180 },
      { width: 800, height: 500 },
    )).toEqual({ x: 520, y: 160 });
  });

  it("clamps old off-screen positions during migration", () => {
    const migrated = migrateLegacyWindowLayout({
      anchor: "free",
      x: 2000,
      y: -100,
      width: 280,
      height: 180,
      z: 2,
    }, { width: 1280, height: 720 });
    expect(migrated).toMatchObject({ xRatio: 1, yRatio: 0 });
  });
});
