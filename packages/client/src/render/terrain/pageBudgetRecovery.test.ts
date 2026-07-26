import { describe, expect, it, vi } from "vitest";
import {
  planPageBudgetRecovery,
  queuePageBudgetRetries,
  recoverPageBudgetBlockedBuild,
  resetPageBudgetBlocksForWindow,
} from "./pageBudgetRecovery.js";

describe("planPageBudgetRecovery", () => {
  it("evicts deterministic margin residency before blanking a visible replacement", () => {
    expect(planPageBudgetRecovery(
      "visible",
      ["visible", "margin-a", "margin-b"],
      new Set(["visible"]),
    )).toEqual({ kind: "evict-margin", key: "margin-a" });
  });

  it("releases only the stale chunk when a rotation replacement has no margin headroom", () => {
    expect(planPageBudgetRecovery(
      "visible",
      ["visible", "other-visible"],
      new Set(["visible", "other-visible"]),
    )).toEqual({ kind: "release-replacement", key: "visible" });
  });

  it("abandons a build that still cannot fit after reclaiming eligible residency", () => {
    expect(planPageBudgetRecovery(
      "missing",
      ["other-visible"],
      new Set(["missing", "other-visible"]),
    )).toEqual({ kind: "abandon-build" });
  });

  it("applies margin eviction without canceling the blocked visible build", () => {
    const blocked = { cancel: vi.fn() };
    const marginBuilder = { cancel: vi.fn() };
    const visible = { cx: 0 };
    const margin = { cx: 1 };
    const visuals = new Map([["visible", visible], ["margin", margin]]);
    const builders = new Map([["visible", blocked], ["margin", marginBuilder]]);
    const blockedKeys = new Set<string>();
    const destroy = vi.fn();

    const released = recoverPageBudgetBlockedBuild(
      "visible", blocked as never, visuals as never, builders as never, blockedKeys,
      new Set(["visible"]), destroy,
    );

    expect(destroy).toHaveBeenCalledWith(margin);
    expect(marginBuilder.cancel).toHaveBeenCalledOnce();
    expect(blocked.cancel).not.toHaveBeenCalled();
    expect(blockedKeys).toEqual(new Set(["margin"]));
    expect(released).toBe(false);
  });

  it("reports stale replacement release as capacity recovered by the continuing build", () => {
    const builder = { cancel: vi.fn() };
    const stale = { cx: 0 };
    const visuals = new Map([["visible", stale]]);

    const released = recoverPageBudgetBlockedBuild(
      "visible", builder as never, visuals as never,
      new Map([["visible", builder]]) as never, new Set(),
      new Set(["visible"]), vi.fn(),
    );

    expect(released).toBe(true);
    expect(visuals.size).toBe(0);
    expect(builder.cancel).not.toHaveBeenCalled();
  });

  it("suppresses an intrinsically unfit build instead of retrying it", () => {
    const blocked = { cancel: vi.fn() };
    const builders = new Map([["missing", blocked]]);
    const blockedKeys = new Set<string>();

    recoverPageBudgetBlockedBuild(
      "missing", blocked as never, new Map(), builders as never, blockedKeys,
      new Set(["missing"]), vi.fn(),
    );

    expect(blocked.cancel).toHaveBeenCalledOnce();
    expect(builders.size).toBe(0);
    expect(blockedKeys).toEqual(new Set(["missing"]));
  });

  it("retries suppressed chunks only after the streaming window changes", () => {
    const blockedKeys = new Set(["0,0"]);
    const view = { x: 0, y: 0, width: 100, height: 100 };
    const first = resetPageBudgetBlocksForWindow(view, 0, "", blockedKeys);
    expect(blockedKeys.size).toBe(0);
    blockedKeys.add("0,0");
    expect(resetPageBudgetBlocksForWindow(view, 0, first, blockedKeys)).toBe(first);
    expect(blockedKeys).toEqual(new Set(["0,0"]));
  });

  it("requeues suppressed chunks after a successful build frees headroom", () => {
    const blockedKeys = new Set(["1,-2", "3,4"]);
    const bakeQueue = [{ cx: 0, cy: 0 }];

    queuePageBudgetRetries(blockedKeys, bakeQueue, true);

    expect(bakeQueue).toEqual([
      { cx: 0, cy: 0 },
      { cx: 1, cy: -2 },
      { cx: 3, cy: 4 },
    ]);
    expect(blockedKeys.size).toBe(0);
  });

  it("keeps suppression after a capacity-neutral build", () => {
    const blockedKeys = new Set(["1,-2"]);
    const bakeQueue = [{ cx: 0, cy: 0 }];

    queuePageBudgetRetries(blockedKeys, bakeQueue, false);

    expect(bakeQueue).toEqual([{ cx: 0, cy: 0 }]);
    expect(blockedKeys).toEqual(new Set(["1,-2"]));
  });
});
