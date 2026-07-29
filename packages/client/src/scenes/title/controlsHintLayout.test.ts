import { describe, expect, it } from "vitest";
import {
  COMPACT_CONTROLS_LINE,
  CONTROLS_LINE,
  TITLE_HINT_GUTTER,
  titleHintContent,
  titleHintLayout,
} from "./controlsHintLayout.js";

describe("title hint content", () => {
  it("advertises Z/X rotation without assigning reserved Q", () => {
    expect(CONTROLS_LINE).toContain("Z/X rotate");
    expect(CONTROLS_LINE).not.toMatch(/\bQ\b/);
  });

  it("keeps the full accessible text on desktop", () => {
    expect(titleHintContent(800)).toEqual({
      premiseVisible: true,
      controlsText: CONTROLS_LINE,
    });
  });

  it("keeps the phone layout readable by hiding only the premise", () => {
    expect(titleHintContent(390)).toEqual({
      premiseVisible: false,
      controlsText: COMPACT_CONTROLS_LINE,
    });
  });

  it("uses the compact copy in short landscape viewports", () => {
    expect(titleHintContent(600)).toEqual({
      premiseVisible: false,
      controlsText: COMPACT_CONTROLS_LINE,
    });
  });
});

describe("title hint layout", () => {
  it("recomputes its door clearance and copy in both resize directions", () => {
    expect(titleHintLayout(1280, 800)).toMatchObject({
      topPx: 304,
      premiseVisible: true,
      controlsText: CONTROLS_LINE,
    });
    expect(titleHintLayout(844, 390)).toMatchObject({
      topPx: 159,
      premiseVisible: false,
      controlsText: COMPACT_CONTROLS_LINE,
    });
    expect(titleHintLayout(1280, 800)).toMatchObject({
      topPx: 304,
      premiseVisible: true,
      controlsText: CONTROLS_LINE,
    });
  });

  it("keeps narrow layouts inside equal viewport gutters", () => {
    const layout = titleHintLayout(320, 700);
    expect(layout.widthPx).toBe(320 - TITLE_HINT_GUTTER * 2);
    expect((320 - layout.widthPx) / 2).toBe(TITLE_HINT_GUTTER);
  });
});
