/** Unit tests for rotating 3-Bounty Board & Guide quests tracking and claiming [REQ-P9-12][REQ-P9-13]. */
import { createEmptyInventoryState } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { BountyAndQuestTracker } from "./bountyTracker.js";

describe("[REQ-P9-12][REQ-P9-13] BountyAndQuestTracker", () => {
  it("generates 3 seeded bounties, increments objective counters, and claims Gold + item atomically", () => {
    const tracker = new BountyAndQuestTracker(1337);
    const list = tracker.bountiesFor("acct-1");
    expect(list.length).toBe(3);
    const wolfBounty = list.find((b) => b.id === "bounty-wolf-cull") ?? list[0];
    if (!wolfBounty) throw new Error("expected bounty");

    expect(tracker.acceptBounty("acct-1", wolfBounty.id)).toBe(true);
    for (let i = 0; i < wolfBounty.required; i++) {
      tracker.recordKill("acct-1", "wolf");
      tracker.recordObjective("acct-1", "discover");
      tracker.recordObjective("acct-1", "clear-camp");
      tracker.recordObjective("acct-1", "attune-waystone");
    }

    const inv = createEmptyInventoryState();
    const claim = tracker.claimBounty({ accountId: "acct-1", bountyId: wolfBounty.id, gold: 10, inventory: inv });
    expect(claim.ok).toBe(true);
    expect(claim.gold).toBe(10 + wolfBounty.rewardGold);
    expect(tracker.claimBounty({ accountId: "acct-1", bountyId: wolfBounty.id, gold: claim.gold, inventory: inv }).ok).toBe(false);
  });

  it("offers 4 Floor Guide side-quests and preserves hydration state", () => {
    const tracker = new BountyAndQuestTracker(1337);
    const quests = tracker.questsFor("acct-2");
    expect(quests.length).toBeGreaterThanOrEqual(4);
    expect(tracker.acceptQuest("acct-2", "quest-attune-waystone")).toBe(true);
    expect(tracker.recordObjective("acct-2", "attune-waystone")).toBe(true);

    const restored = new BountyAndQuestTracker(1337);
    restored.hydratePlayer("acct-2", { quests: tracker.questsFor("acct-2") });
    const inv = createEmptyInventoryState();
    const res = restored.claimQuest({ accountId: "acct-2", questId: "quest-attune-waystone", gold: 0, inventory: inv });
    expect(res.ok).toBe(true);
    expect(res.rewardGold).toBeGreaterThan(0);
  });
});
