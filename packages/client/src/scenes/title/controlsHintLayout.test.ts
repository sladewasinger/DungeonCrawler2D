// Headless coverage for TitleControlsHint's viewport-aware stacking — the judge-panel
// finding was the premise paragraph and controls cheat-sheet rendering on top of each
// other into "an unreadable mess" at 844x390 (a landscape phone).
import { describe, expect, it } from "vitest";
import {
  COMPACT_CONTROLS_LINE,
  CONTROLS_LINE,
  computeControlsHintLayout,
  isShortViewport,
  wrapWidthFor,
} from "./controlsHintLayout.js";

describe("isShortViewport", () => {
  it("treats 844x390 (landscape phone) as short", () => {
    expect(isShortViewport(390)).toBe(true);
  });

  it("treats a roomy desktop viewport as not short", () => {
    expect(isShortViewport(800)).toBe(false);
  });
});

describe("wrapWidthFor", () => {
  it("clamps to the viewport width minus margin on a narrow screen", () => {
    expect(wrapWidthFor(300)).toBe(300 - 48);
  });

  it("caps at WRAP_WIDTH on a wide screen", () => {
    expect(wrapWidthFor(1920)).toBeLessThanOrEqual(640);
  });
});

describe("computeControlsHintLayout at 844x390", () => {
  const positions = computeControlsHintLayout(390, 20, 60, 16);

  it("collapses to the compact controls line", () => {
    expect(positions.short).toBe(true);
    expect(positions.controlsText).toBe(COMPACT_CONTROLS_LINE);
  });

  it("hides the premise paragraph", () => {
    expect(positions.premiseVisible).toBe(false);
  });

  it("places the controls line clear of the tagline — no overlap even with a tall tagline", () => {
    const taglineBottom = positions.taglineY + 20 / 2;
    const controlsTop = positions.controlsY - 16 / 2;
    expect(controlsTop).toBeGreaterThan(taglineBottom);
  });
});

describe("computeControlsHintLayout on a roomy desktop viewport", () => {
  const positions = computeControlsHintLayout(800, 20, 60, 16);

  it("shows the full premise and cheat-sheet", () => {
    expect(positions.short).toBe(false);
    expect(positions.premiseVisible).toBe(true);
    expect(positions.controlsText).toBe(CONTROLS_LINE);
  });

  it("stacks premise below the tagline and controls below the premise without overlap", () => {
    const taglineBottom = positions.taglineY + 20 / 2;
    expect(positions.premiseY).toBeGreaterThanOrEqual(taglineBottom);
    const premiseBottom = positions.premiseY + 60;
    const controlsTop = positions.controlsY - 16 / 2;
    expect(controlsTop).toBeGreaterThanOrEqual(premiseBottom);
  });

  it("stacking still clears a much taller (multi-line) premise wrap", () => {
    const tall = computeControlsHintLayout(800, 20, 240, 16);
    const premiseBottom = tall.premiseY + 240;
    const controlsTop = tall.controlsY - 16 / 2;
    expect(controlsTop).toBeGreaterThanOrEqual(premiseBottom);
  });
});
