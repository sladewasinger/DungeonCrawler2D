import { describe, expect, it } from "vitest";
import { shouldPresentWorldVisual } from "./worldVisualVisibility.js";

describe("world visual visibility", () => {
  const hidden = { isWorldPositionVisible: () => false, revision: 1 };
  const visible = { isWorldPositionVisible: () => true, revision: 1 };

  it("suppresses hidden remote targets", () => {
    expect(shouldPresentWorldVisual({ x: 4, y: 5 }, hidden)).toBe(false);
  });

  it("preserves self feedback even when the mask excludes the player", () => {
    expect(shouldPresentWorldVisual({ x: 4, y: 5, isSelf: true }, hidden)).toBe(true);
  });

  it("leaves world effects enabled without Toon visibility", () => {
    expect(shouldPresentWorldVisual({ x: 4, y: 5 }, null)).toBe(true);
    expect(shouldPresentWorldVisual({ x: 4, y: 5 }, visible)).toBe(true);
  });
});
