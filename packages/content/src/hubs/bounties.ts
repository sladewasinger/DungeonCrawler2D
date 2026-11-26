/** Deterministic rotating 3-Bounty Board catalog and seeded per-floor bounty generator. */
import type { HubObjectiveKind } from "./quests.js";

export interface BountyTemplateDef {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly objectiveKind: HubObjectiveKind;
  readonly targetKind?: string | undefined;
  readonly targetCount: number;
  readonly rewardGold: number;
  readonly rewardItem?: { readonly itemId: string; readonly count: number } | undefined;
}

export const BOUNTY_TEMPLATES: readonly BountyTemplateDef[] = [
  {
    id: "bounty-wolf-cull",
    title: "Timber Pack Bounty",
    summary: "Slay 4 Wolves prowling the forest.",
    objectiveKind: "kill",
    targetKind: "wolf",
    targetCount: 4,
    rewardGold: 55,
    rewardItem: { itemId: "arrow", count: 12 },
  },
  {
    id: "bounty-goblin-raiders",
    title: "Goblin Troublemakers",
    summary: "Defeat 4 Goblins or Boars near frontier camps.",
    objectiveKind: "kill",
    targetKind: "any-hostile",
    targetCount: 4,
    rewardGold: 60,
    rewardItem: { itemId: "bandage", count: 3 },
  },
  {
    id: "bounty-ruin-spoils",
    title: "Sunken Spoils",
    summary: "Discover 2 new Overworld landmarks.",
    objectiveKind: "discover",
    targetCount: 2,
    rewardGold: 70,
    rewardItem: { itemId: "copper-ingot", count: 2 },
  },
  {
    id: "bounty-camp-breaker",
    title: "Raider Strongbox",
    summary: "Open 1 POI treasure chest outside Sanctuary.",
    objectiveKind: "clear-camp",
    targetCount: 1,
    rewardGold: 80,
    rewardItem: { itemId: "healing-salve", count: 2 },
  },
  {
    id: "bounty-waystone-pulse",
    title: "Leyline Beacon",
    summary: "Attune 1 Ancient Waystone monument.",
    objectiveKind: "attune-waystone",
    targetCount: 1,
    rewardGold: 75,
    rewardItem: { itemId: "iron-ingot", count: 1 },
  },
];

export function generateFloorBounties(worldSeed: number, cycleIndex = 0): readonly BountyTemplateDef[] {
  const n = BOUNTY_TEMPLATES.length;
  const start = Math.abs(Math.floor(worldSeed + cycleIndex * 3)) % n;
  return [
    BOUNTY_TEMPLATES[start]!,
    BOUNTY_TEMPLATES[(start + 1) % n]!,
    BOUNTY_TEMPLATES[(start + 2) % n]!,
  ];
}

export function getBountyTemplateDef(bountyId: string): BountyTemplateDef | undefined {
  return BOUNTY_TEMPLATES.find((b) => b.id === bountyId);
}
