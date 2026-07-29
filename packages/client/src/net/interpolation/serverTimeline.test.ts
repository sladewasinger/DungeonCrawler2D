import { describe, expect, it } from "vitest";
import { ServerTimeline } from "./serverTimeline.js";

describe("ServerTimeline", () => {
  it("advances continuously between snapshots instead of inheriting arrival jitter", () => {
    const timeline = new ServerTimeline();
    expect(timeline.observe(100, 1000)).toBe(5000);
    expect(timeline.now(1050)).toBe(5050);

    timeline.observe(101, 1080);

    expect(timeline.now(1080)).toBe(5077);
    expect(timeline.now(1100)).toBe(5097);
  });

  it("limits phase corrections and resets cleanly across tick discontinuities", () => {
    const timeline = new ServerTimeline();
    timeline.observe(100, 1000);
    timeline.observe(110, 1050);
    expect(timeline.now(1050)).toBe(5055);

    expect(timeline.observe(2, 1100)).toBe(100);
    expect(timeline.now(1125)).toBe(125);

    timeline.reset();
    expect(timeline.now(2000)).toBe(2000);
  });
});
