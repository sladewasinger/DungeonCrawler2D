/** Deterministic Floor Guide Mentor side-quests with objectives, dialogue, and rewards. */

export type HubObjectiveKind = "kill" | "clear-camp" | "attune-waystone" | "discover" | "collect" | "smelt";

export interface GuideQuestDef {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly dialogue: string;
  readonly objectiveKind: HubObjectiveKind;
  readonly targetKind?: string | undefined;
  readonly targetCount: number;
  readonly rewardGold: number;
  readonly rewardItem?: { readonly itemId: string; readonly count: number; readonly prefixId?: string | undefined } | undefined;
}

export const FLOOR_GUIDE_QUESTS: readonly GuideQuestDef[] = [
  {
    id: "quest-light-way",
    title: "Light the Way",
    summary: "Craft or carry torches and fell 3 hostile wolves or goblins.",
    dialogue: "The forest darkens fast beyond Sanctuary torchlight. Thin the beasts stalking the outer glades.",
    objectiveKind: "kill",
    targetCount: 3,
    rewardGold: 45,
    rewardItem: { itemId: "healing-salve", count: 2 },
  },
  {
    id: "quest-bandit-camp",
    title: "Clear the Bandit Camp",
    summary: "Loot or clear any Raider Encampment or Ancient Ruins chest.",
    dialogue: "Scavengers set palisades east of the glade. Breach their camp and open their supply chest.",
    objectiveKind: "clear-camp",
    targetCount: 1,
    rewardGold: 75,
    rewardItem: { itemId: "copper-ingot", count: 2 },
  },
  {
    id: "quest-attune-waystone",
    title: "Attune a Waystone",
    summary: "Discover and activate an Ancient Waystone landmark.",
    dialogue: "Waystones pierce the map fog with distant beacons. Seek out a stone spire and attune it.",
    objectiveKind: "attune-waystone",
    targetCount: 1,
    rewardGold: 65,
    rewardItem: { itemId: "swiftness-draught", count: 1 },
  },
  {
    id: "quest-mine-iron",
    title: "Mine Highland Iron",
    summary: "Discover 3 Overworld landmarks across the frontier.",
    dialogue: "Chart the surrounding wilds — every ruin or shrine strengthens our foothold before collapse.",
    objectiveKind: "discover",
    targetCount: 3,
    rewardGold: 95,
    rewardItem: { itemId: "sword", count: 1, prefixId: "keen" },
  },
];

export function getGuideQuestDef(questId: string): GuideQuestDef | undefined {
  return FLOOR_GUIDE_QUESTS.find((q) => q.id === questId);
}
