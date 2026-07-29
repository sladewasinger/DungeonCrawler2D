import { describe, expect, it } from "vitest";
import {
  speechBubbleLayout,
  speechBubbleWrapWidth,
} from "./roomSpeechGeometry.js";
import { ROOM_SPEECH_VISUAL_STYLE } from "./roomSpeechVisualStyle.js";

const speaker = { x: 100, y: 80, width: 24, height: 20 };
const bubble = { width: 120, height: 36 };
const viewport = { x: 0, y: 0, width: 320, height: 180 };

describe("room speech bubble placement", () => {
  it("anchors spawn intercom speech below the speaker", () => {
    const layout = speechBubbleLayout({
      speaker,
      bubble,
      viewport,
      speakerKind: "spawn-intercom",
    });

    expect(ROOM_SPEECH_VISUAL_STYLE.bubble.spawnIntercomOffsetYPx)
      .toBeGreaterThan(0);
    expect(layout).toEqual({
      x: speaker.x,
      y: speaker.y + speaker.height / 2 +
        ROOM_SPEECH_VISUAL_STYLE.bubble.spawnIntercomOffsetYPx,
      originY: 0,
    });
  });

  it("keeps the attendant bubble above the speaker and inside the viewport", () => {
    const layout = speechBubbleLayout({
      speaker,
      bubble,
      viewport,
      speakerKind: "attendant",
    });

    expect(layout.y).toBeLessThan(speaker.y);
    expect(layout.y - bubble.height).toBe(
      viewport.y + ROOM_SPEECH_VISUAL_STYLE.bubble.viewportMarginPx,
    );
    expect(layout.originY).toBe(1);
  });

  it("wraps and clamps the bubble within a small viewport", () => {
    const smallViewport = { x: 10, y: 20, width: 120, height: 80 };
    const wrapWidth = speechBubbleWrapWidth(smallViewport.width);
    const displayWidth = wrapWidth +
      ROOM_SPEECH_VISUAL_STYLE.bubble.horizontalPaddingPx * 2;
    const layout = speechBubbleLayout({
      speaker: { ...speaker, x: -100, y: -100 },
      bubble: { width: displayWidth, height: 40 },
      viewport: smallViewport,
      speakerKind: "spawn-intercom",
    });

    expect(wrapWidth).toBe(80);
    expect(layout).toEqual({ x: 70, y: 32, originY: 0 });
  });
});
