import { describe, expect, it } from "vitest";
import { TOAST_FADE_MS, visibleToasts } from "./toastQueue.js";

describe("visibleToasts", () => {
  it("drops expired toasts", () => {
    const toasts = [
      { msg: "old", until: 1000 },
      { msg: "fresh", until: 5000 },
    ];
    const views = visibleToasts(toasts, 2000);
    expect(views).toEqual([{ msg: "fresh", alpha: 1 }]);
  });

  it("orders newest-pushed first (queue is oldest-to-newest, view is reversed)", () => {
    const toasts = [
      { msg: "first", until: 5000 },
      { msg: "second", until: 5000 },
    ];
    const views = visibleToasts(toasts, 0);
    expect(views.map((v) => v.msg)).toEqual(["second", "first"]);
  });

  it("fades a toast's alpha over its final TOAST_FADE_MS", () => {
    const toasts = [{ msg: "bye", until: 1000 }];
    const halfway = visibleToasts(toasts, 1000 - TOAST_FADE_MS / 2);
    expect(halfway[0]?.alpha).toBeCloseTo(0.5);
    const justBorn = visibleToasts(toasts, 1000 - TOAST_FADE_MS * 5);
    expect(justBorn[0]?.alpha).toBe(1);
  });

  it("returns an empty list when nothing is live", () => {
    expect(visibleToasts([], 0)).toEqual([]);
    expect(visibleToasts([{ msg: "gone", until: -1 }], 0)).toEqual([]);
  });
});
