/** Authoritative rotating 3-Bounty Board & Floor Guide quest state tracker [REQ-P9-12][REQ-P9-13]. */
import {
  FLOOR_GUIDE_QUESTS, generateFloorBounties, getBountyTemplateDef, getGuideQuestDef,
  maxStackForItem, type GuideQuestDef, type HubObjectiveKind,
} from "@dc2d/content";
import {
  canInsertSlotItem, insertIntoSlots, makeSlotItem,
  type ActiveBountyState, type ActiveQuestState, type PlayerInventoryState,
} from "@dc2d/engine";

interface MutableObjectiveItem {
  readonly id: string; readonly title: string; readonly description: string;
  readonly targetKind?: string | undefined; readonly objectiveKind: HubObjectiveKind;
  readonly dialogue?: string | undefined; readonly hintText?: string | undefined;
  progress: number; readonly required: number; readonly rewardGold: number;
  readonly rewardItemId?: string | undefined; readonly rewardCount?: number | undefined;
  readonly rewardPrefixId?: string | undefined; accepted: boolean; claimed: boolean;
}

export interface ClaimOutcome {
  readonly ok: boolean; readonly gold: number; readonly rewardGold: number; readonly error?: string | undefined;
}

function buildInitialBounties(worldSeed: number): MutableObjectiveItem[] {
  return generateFloorBounties(worldSeed).map((def) => ({
    id: def.id, title: def.title, description: def.summary, targetKind: def.targetKind ?? def.objectiveKind,
    objectiveKind: def.objectiveKind, progress: 0, required: def.targetCount, rewardGold: def.rewardGold,
    ...(def.rewardItem ? { rewardItemId: def.rewardItem.itemId, rewardCount: def.rewardItem.count } : {}),
    accepted: false, claimed: false,
  }));
}

function questHint(def: GuideQuestDef): string {
  if (def.objectiveKind === "kill") return "Leave Spawn Sanctuary and hunt forest packs nearby.";
  if (def.objectiveKind === "clear-camp") return "Follow trails east or west to find an enemy chest.";
  if (def.objectiveKind === "attune-waystone") return "Interact [E] with a gleaming blue Waystone pillar.";
  return "Explore revealed chunks beyond Sanctuary to chart landmarks.";
}

function buildInitialQuests(): MutableObjectiveItem[] {
  return FLOOR_GUIDE_QUESTS.map((def) => ({
    id: def.id, title: def.title, description: def.summary, dialogue: def.dialogue, hintText: questHint(def),
    objectiveKind: def.objectiveKind, targetKind: def.targetKind, progress: 0, required: def.targetCount, rewardGold: def.rewardGold,
    ...(def.rewardItem ? { rewardItemId: def.rewardItem.itemId, rewardCount: def.rewardItem.count, rewardPrefixId: def.rewardItem.prefixId } : {}),
    accepted: false, claimed: false,
  }));
}

function toBountySnapshot(b: MutableObjectiveItem): ActiveBountyState {
  return {
    id: b.id, title: b.title, description: b.description, targetKind: b.targetKind ?? b.objectiveKind,
    progress: b.progress, required: b.required, rewardGold: b.rewardGold,
    ...(b.rewardItemId ? { rewardItemId: b.rewardItemId, rewardCount: b.rewardCount ?? 1 } : {}),
    accepted: b.accepted, claimed: b.claimed,
  };
}

function toQuestSnapshot(q: MutableObjectiveItem): ActiveQuestState {
  return {
    id: q.id, title: q.title, description: q.description, dialogue: q.dialogue ?? "", hintText: q.hintText ?? "",
    progress: q.progress, required: q.required, rewardGold: q.rewardGold,
    ...(q.rewardItemId ? { rewardItemId: q.rewardItemId, rewardCount: q.rewardCount ?? 1 } : {}),
    accepted: q.accepted, claimed: q.claimed,
  };
}

function mergeSavedProgress(
  base: MutableObjectiveItem[],
  saved: readonly { readonly id: string; readonly accepted: boolean; readonly claimed: boolean; readonly progress: number }[] | undefined,
): MutableObjectiveItem[] {
  if (!saved || saved.length === 0) return base;
  const byId = new Map(saved.map((item) => [item.id, item]));
  for (const item of base) {
    const s = byId.get(item.id);
    if (!s) continue;
    item.accepted = Boolean(s.accepted);
    item.claimed = Boolean(s.claimed);
    item.progress = Math.max(0, Math.min(item.required, Math.floor(s.progress)));
  }
  return base;
}

function grantClaimReward(opts: {
  readonly gold: number; readonly inventory: PlayerInventoryState; readonly item: MutableObjectiveItem;
}): ClaimOutcome {
  if (opts.item.rewardItemId) {
    const reward = makeSlotItem(opts.item.rewardItemId, opts.item.rewardCount ?? 1, opts.item.rewardPrefixId);
    if (!canInsertSlotItem(opts.inventory.slots, reward, maxStackForItem)) {
      return { ok: false, gold: opts.gold, rewardGold: 0, error: "Inventory full" };
    }
    insertIntoSlots(opts.inventory.slots, reward, maxStackForItem);
  }
  opts.item.claimed = true;
  return { ok: true, gold: opts.gold + opts.item.rewardGold, rewardGold: opts.item.rewardGold };
}

function enemyTargetAllowed(targetKind: string | undefined, enemyKind: string | undefined): boolean {
  if (!enemyKind || !targetKind) return true;
  return targetKind === "any-hostile" || targetKind === "kill" || targetKind === enemyKind;
}

function matchesBumpTarget(
  entry: MutableObjectiveItem,
  opts: { readonly kind: HubObjectiveKind; readonly enemyKind?: string },
): boolean {
  if (!entry.accepted || entry.claimed || entry.progress >= entry.required) return false;
  return entry.objectiveKind === opts.kind && enemyTargetAllowed(entry.targetKind, opts.enemyKind);
}

export class BountyAndQuestTracker {
  private readonly bountiesByAccount = new Map<string, MutableObjectiveItem[]>();
  private readonly questsByAccount = new Map<string, MutableObjectiveItem[]>();
  constructor(private readonly worldSeed: number) {}

  private ensureList(map: Map<string, MutableObjectiveItem[]>, acct: string, init: () => MutableObjectiveItem[]): MutableObjectiveItem[] {
    let list = map.get(acct);
    if (!list) { list = init(); map.set(acct, list); }
    return list;
  }

  bountiesFor(accountId: string): ActiveBountyState[] {
    return this.ensureList(this.bountiesByAccount, accountId, () => buildInitialBounties(this.worldSeed)).map(toBountySnapshot);
  }
  questsFor(accountId: string): ActiveQuestState[] {
    return this.ensureList(this.questsByAccount, accountId, buildInitialQuests).map(toQuestSnapshot);
  }

  hydratePlayer(accountId: string, saved?: { readonly bounties?: readonly ActiveBountyState[] | undefined; readonly quests?: readonly ActiveQuestState[] | undefined }): void {
    this.bountiesByAccount.set(accountId, mergeSavedProgress(buildInitialBounties(this.worldSeed), saved?.bounties));
    this.questsByAccount.set(accountId, mergeSavedProgress(buildInitialQuests(), saved?.quests));
  }

  acceptBounty(accountId: string, bountyId: string): boolean {
    if (!getBountyTemplateDef(bountyId)) return false;
    const item = this.ensureList(this.bountiesByAccount, accountId, () => buildInitialBounties(this.worldSeed)).find((b) => b.id === bountyId);
    if (!item || item.accepted || item.claimed) return false;
    item.accepted = true; return true;
  }
  acceptQuest(accountId: string, questId: string): boolean {
    if (!getGuideQuestDef(questId)) return false;
    const item = this.ensureList(this.questsByAccount, accountId, buildInitialQuests).find((q) => q.id === questId);
    if (!item || item.accepted || item.claimed) return false;
    item.accepted = true; return true;
  }

  claimBounty(opts: { readonly accountId: string; readonly bountyId: string; readonly gold: number; readonly inventory: PlayerInventoryState }): ClaimOutcome {
    const item = this.ensureList(this.bountiesByAccount, opts.accountId, () => buildInitialBounties(this.worldSeed)).find((b) => b.id === opts.bountyId);
    if (!item || !item.accepted || item.claimed || item.progress < item.required) return { ok: false, gold: opts.gold, rewardGold: 0, error: "Bounty objectives incomplete" };
    return grantClaimReward({ gold: opts.gold, inventory: opts.inventory, item });
  }
  claimQuest(opts: { readonly accountId: string; readonly questId: string; readonly gold: number; readonly inventory: PlayerInventoryState }): ClaimOutcome {
    const item = this.ensureList(this.questsByAccount, opts.accountId, buildInitialQuests).find((q) => q.id === opts.questId);
    if (!item || !item.accepted || item.claimed || item.progress < item.required) return { ok: false, gold: opts.gold, rewardGold: 0, error: "Quest objectives incomplete" };
    return grantClaimReward({ gold: opts.gold, inventory: opts.inventory, item });
  }

  private bumpList(list: MutableObjectiveItem[], opts: { readonly kind: HubObjectiveKind; readonly delta: number; readonly enemyKind?: string }): boolean {
    let changed = false;
    for (const entry of list) {
      if (!matchesBumpTarget(entry, opts)) continue;
      entry.progress = Math.min(entry.required, entry.progress + opts.delta);
      changed = true;
    }
    return changed;
  }

  recordKill(accountId: string, enemyKind: string): boolean {
    const bCh = this.bumpList(this.ensureList(this.bountiesByAccount, accountId, () => buildInitialBounties(this.worldSeed)), { kind: "kill", delta: 1, enemyKind });
    const qCh = this.bumpList(this.ensureList(this.questsByAccount, accountId, buildInitialQuests), { kind: "kill", delta: 1 });
    return bCh || qCh;
  }
  recordObjective(accountId: string, kind: HubObjectiveKind, delta = 1): boolean {
    const bCh = this.bumpList(this.ensureList(this.bountiesByAccount, accountId, () => buildInitialBounties(this.worldSeed)), { kind, delta });
    const qCh = this.bumpList(this.ensureList(this.questsByAccount, accountId, buildInitialQuests), { kind, delta });
    return bCh || qCh;
  }
}
