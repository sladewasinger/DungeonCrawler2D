/** Five-tier item rarity metadata, visual accent colors, and rarity-bump helpers. */
import { RARITY_ORDER, type ItemRarity } from "@dc2d/contracts";

export { RARITY_ORDER };
export type { ItemRarity };

export interface RarityMeta {
  readonly id: ItemRarity;
  readonly label: string;
  readonly color: string;
  readonly borderColor: string;
  readonly glowColor: string;
  readonly bgTint: string;
  readonly rank: number;
}

export const RARITY_META: Readonly<Record<ItemRarity, RarityMeta>> = {
  common: {
    id: "common",
    label: "Common",
    color: "#cbd5e1",
    borderColor: "rgba(148, 163, 184, 0.32)",
    glowColor: "rgba(203, 213, 225, 0.14)",
    bgTint: "rgba(15, 23, 42, 0.86)",
    rank: 0,
  },
  uncommon: {
    id: "uncommon",
    label: "Uncommon",
    color: "#4ade80",
    borderColor: "rgba(74, 222, 128, 0.72)",
    glowColor: "rgba(74, 222, 128, 0.28)",
    bgTint: "rgba(12, 42, 26, 0.82)",
    rank: 1,
  },
  rare: {
    id: "rare",
    label: "Rare",
    color: "#60a5fa",
    borderColor: "rgba(96, 165, 250, 0.82)",
    glowColor: "rgba(59, 130, 246, 0.34)",
    bgTint: "rgba(15, 32, 62, 0.85)",
    rank: 2,
  },
  epic: {
    id: "epic",
    label: "Epic",
    color: "#c084fc",
    borderColor: "rgba(192, 132, 252, 0.88)",
    glowColor: "rgba(168, 85, 247, 0.38)",
    bgTint: "rgba(42, 18, 64, 0.86)",
    rank: 3,
  },
  legendary: {
    id: "legendary",
    label: "Legendary",
    color: "#fbbf24",
    borderColor: "rgba(251, 191, 36, 0.95)",
    glowColor: "rgba(245, 158, 11, 0.48)",
    bgTint: "rgba(62, 36, 10, 0.88)",
    rank: 4,
  },
};

export function getRarityMeta(rarity: ItemRarity | undefined): RarityMeta {
  return RARITY_META[rarity ?? "common"];
}

export function bumpRarity(base: ItemRarity, steps: number): ItemRarity {
  const idx = RARITY_ORDER.indexOf(base);
  const nextIdx = Math.max(0, Math.min(RARITY_ORDER.length - 1, (idx < 0 ? 0 : idx) + steps));
  return RARITY_ORDER[nextIdx] ?? "common";
}
