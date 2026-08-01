import { describe, expect, it } from "vitest";
import {
  SPECTATOR_PRESENTATION_DELAY_MS,
  spectatorPresentationDelay,
} from "./spectatorPresentationTimeline.js";

describe("spectator buffered presentation timeline", () => {
  it("keeps a stable-link spectator intentionally buffered", () => {
    expect(spectatorPresentationDelay(75)).toBe(SPECTATOR_PRESENTATION_DELAY_MS);
  });

  it("retains a larger adaptive delay during irregular snapshot arrivals", () => {
    expect(spectatorPresentationDelay(150)).toBe(150);
  });
});
