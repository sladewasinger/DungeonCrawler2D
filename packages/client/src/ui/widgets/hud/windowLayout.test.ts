import { describe, expect, it } from "vitest";
import { WINDOW_PANEL_HEIGHT, WINDOW_VERTICAL_OFFSET } from "./windowLayout.js";

/** Mirrors closeButton.ts's HIT_SIZE(32)/CLEARANCE(2) overhang math without importing
 * Phaser — this test only needs the two numbers, not a scene. */
const CLOSE_BUTTON_OVERHANG = 34;
const HUD_SCALE = 2;
const REFERENCE_VIEWPORT_HEIGHT = 720;
const HOTBAR_TOP = 592; // hotbar.ts's geometry at the shipped default-layout.json offsets

describe("window panel vertical fit (desktop reference viewport)", () => {
  // Every window draws its panel background at local (-W/2,-H/2)..(W/2,H/2) (see e.g.
  // inventoryWindow.ts's drawPanelBackground call) — half of PANEL_HEIGHT above/below
  // the container's own y, which is what WINDOW_VERTICAL_OFFSET positions.
  const containerY = REFERENCE_VIEWPORT_HEIGHT / 2 + WINDOW_VERTICAL_OFFSET * HUD_SCALE;
  const halfHeight = WINDOW_PANEL_HEIGHT / 2;

  it("keeps the close button's hit box on-screen", () => {
    const closeButtonTop = containerY - (halfHeight + CLOSE_BUTTON_OVERHANG) * HUD_SCALE;
    expect(closeButtonTop).toBeGreaterThan(0);
  });

  it("keeps the panel's bottom edge clear of the hotbar", () => {
    const panelBottom = containerY + halfHeight * HUD_SCALE;
    expect(panelBottom).toBeLessThan(HOTBAR_TOP);
  });
});
