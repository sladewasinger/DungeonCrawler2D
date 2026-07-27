/** Maps authoritative entity snapshots to lightweight first-person visuals. */
import type { EntitySnapshot } from "@dc2d/engine";

export type ThreeWorldEntityKind = "item" | "lootChest" | "projectile" | "torch";

export interface ThreeEntityPresentation {
  kind: ThreeWorldEntityKind;
  color: string;
  emissive: string;
  scale: number;
  elevation: number;
  bob: boolean;
  spin: boolean;
  label?: string;
  unlockAtTick?: number;
}

const itemColors: ReadonlyArray<{ terms: readonly string[]; color: string }> = [
  { terms: ["bandage", "herb"], color: "#78c890" },
  { terms: ["torch", "fire"], color: "#ffad55" },
  { terms: ["sword", "axe"], color: "#c8d0dc" },
  { terms: ["potion"], color: "#bc74d6" },
];

const itemColor = (defId = ""): string =>
  itemColors.find(({ terms }) => terms.some((term) => defId.includes(term)))?.color ?? "#d8b66a";

const lootChestPresentation = (
  snapshot: EntitySnapshot,
): ThreeEntityPresentation => {
  const killedBy = snapshot.lootKillerName
    ? `\nKilled by ${snapshot.lootKillerName}`
    : "";
  return {
    kind: "lootChest",
    color: "#6f4529",
    emissive: "#1a0d06",
    scale: 0.55,
    elevation: 0.24,
    bob: false,
    spin: false,
    label: `[DEAD] ${snapshot.lootOwnerName ?? "Crawler"}'s loot${killedBy}`,
    unlockAtTick: snapshot.lootUnlockAtTick ?? 0,
  };
};

export const threeEntityPresentation = (
  snapshot: EntitySnapshot,
): ThreeEntityPresentation | null => {
  if (snapshot.kind === "item") return itemPresentation(snapshot);
  if (snapshot.kind === "projectile") return projectilePresentation(snapshot);
  return snapshot.kind === "torch" ? torchPresentation(snapshot) : null;
};

const itemPresentation = (snapshot: EntitySnapshot): ThreeEntityPresentation => {
  if (snapshot.defId === "player-loot-chest") return lootChestPresentation(snapshot);
  const color = itemColor(snapshot.defId);
  return {
    kind: "item", color, emissive: color, scale: 0.13, elevation: 0.16, bob: true, spin: true,
  };
};

const projectilePresentation = (snapshot: EntitySnapshot): ThreeEntityPresentation => {
  const color = itemColor(snapshot.defId);
  return { kind: "projectile", color, emissive: color, scale: 0.09, elevation: 0.12, bob: false, spin: true };
};

const torchPresentation = (snapshot: EntitySnapshot): ThreeEntityPresentation => {
  const placed = snapshot.state === "placed";
  return { kind: "torch", color: "#6b4934", emissive: "#ff7a2f", scale: placed ? 0.2 : 0.15, elevation: placed ? 0.24 : 0.1, bob: false, spin: !placed };
};
