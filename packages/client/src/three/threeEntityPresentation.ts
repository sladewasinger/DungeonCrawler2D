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

const itemColor = (defId = ""): string => {
  if (defId.includes("bandage") || defId.includes("herb")) return "#78c890";
  if (defId.includes("torch") || defId.includes("fire")) return "#ffad55";
  if (defId.includes("sword") || defId.includes("axe")) return "#c8d0dc";
  if (defId.includes("potion")) return "#bc74d6";
  return "#d8b66a";
};

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
    elevation: 0.2,
    bob: false,
    spin: false,
    label: `[DEAD] ${snapshot.lootOwnerName ?? "Crawler"}'s loot${killedBy}`,
    unlockAtTick: snapshot.lootUnlockAtTick ?? 0,
  };
};

export const threeEntityPresentation = (
  snapshot: EntitySnapshot,
): ThreeEntityPresentation | null => {
  if (snapshot.kind === "item") {
    if (snapshot.defId === "player-loot-chest") return lootChestPresentation(snapshot);
    const color = itemColor(snapshot.defId);
    return {
      kind: "item",
      color,
      emissive: color,
      scale: 0.13,
      elevation: 0.16,
      bob: true,
      spin: true,
    };
  }
  if (snapshot.kind === "projectile") {
    const color = itemColor(snapshot.defId);
    return {
      kind: "projectile",
      color,
      emissive: color,
      scale: 0.09,
      elevation: 0.12,
      bob: false,
      spin: true,
    };
  }
  if (snapshot.kind !== "torch") return null;
  return {
    kind: "torch",
    color: "#6b4934",
    emissive: "#ff7a2f",
    scale: snapshot.state === "placed" ? 0.2 : 0.15,
    elevation: snapshot.state === "placed" ? 0.24 : 0.1,
    bob: false,
    spin: snapshot.state !== "placed",
  };
};
