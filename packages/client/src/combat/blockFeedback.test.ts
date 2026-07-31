import { describe, expect, it } from "vitest";
import {
  blockFeedbackAlpha,
  BLOCK_FEEDBACK_DURATION_MS,
} from "./blockFeedback.js";

describe("guard-shaped block feedback", () => {
  it("keeps the feedback as a short-lived guard state, not a world circle", () => {
    const feedback = {
      kind: "melee" as const,
      startedAtMs: 100,
    };

    expect(feedback.kind).toBe("melee");
    expect(blockFeedbackAlpha(0)).toBe(1);
    expect(blockFeedbackAlpha(BLOCK_FEEDBACK_DURATION_MS / 2)).toBeCloseTo(0.5);
    expect(blockFeedbackAlpha(BLOCK_FEEDBACK_DURATION_MS)).toBe(0);
  });
});
