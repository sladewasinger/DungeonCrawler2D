import { describe, expect, it } from "vitest";
import {
  contextualHelpText,
  latestVisibleToast,
} from "./HudNotices.js";

const hints = [
  {
    action: "use" as const,
    key: "E",
    touchKey: "USE",
    label: "Use Bandage",
  },
  {
    action: "attack" as const,
    key: "LMB",
    touchKey: "ATTACK",
    label: "Attack with Rusty Sword",
  },
];

describe("contextualHelpText", () => {
  it("renders nearby and contextual actions with desktop controls", () => {
    expect(contextualHelpText({ key: "R", label: "pick up" }, hints, false))
      .toBe("[R] pick up   ·   [E] Use Bandage   ·   [LMB] Attack with Rusty Sword");
  });

  it("uses the real touch action labels", () => {
    expect(contextualHelpText(null, hints, true))
      .toBe("[USE] Use Bandage   ·   [ATTACK] Attack with Rusty Sword");
  });

  it("stays hidden when there is no contextual help", () => {
    expect(contextualHelpText(null, [], false)).toBe("");
  });

  it("selects the newest live toast without reversing the source queue", () => {
    const toasts = [
      { msg: "expired", until: 10 },
      { msg: "older", until: 30 },
      { msg: "newest", until: 40 },
    ];
    expect(latestVisibleToast(toasts, 20)?.msg).toBe("newest");
    expect(toasts.map((toast) => toast.msg)).toEqual([
      "expired",
      "older",
      "newest",
    ]);
  });
});
