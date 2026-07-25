import { describe, expect, it } from "vitest";
import {
  COMPACT_CONTROLS_LINE,
  CONTROLS_LINE,
  titleHintContent,
} from "./controlsHintLayout.js";

describe("title hint content", () => {
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
});
