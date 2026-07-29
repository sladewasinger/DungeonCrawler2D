// Contextual "[key] label" prompt resolution: a nearby stairway (Epic 7.14) takes
// priority over revive, world interaction, and pickup. Selected-item actions use
// ui/actionHelp.ts so persistent controls do not displace nearby-world prompts.
import {
  PICKUP_RANGE,
  resolveWorldInteraction,
  type TileType,
  type WorldInteractionKind,
} from "@dc2d/engine";
import { descentPromptLabel } from "./descentPrompt.js";
import { resolveStairwayPrompt, type StairwayWorld } from "./stairwayProximity.js";

export interface PromptWorld extends StairwayWorld {
  tileAt(wx: number, wy: number): TileType;
}

export interface PromptTarget {
  readonly x: number;
  readonly y: number;
}

export interface PetPromptTarget extends PromptTarget {
  readonly name: string;
  readonly ownerName?: string;
}

function hasNearbyItem(items: readonly PromptTarget[], x: number, y: number): boolean {
  return items.some((item) => Math.hypot(item.x - x, item.y - y) <= PICKUP_RANGE);
}

const worldPrompt = (kind: WorldInteractionKind): InteractionPrompt => {
  if (kind === "arena-gate") {
    return { key: "E", label: "enter mini-boss arena" };
  }
  if (kind === "door") return { key: "E", label: "enter" };
  if (kind === "stash") return { key: "E", label: "open stash" };
  return { key: "E", label: "craft" };
};

export interface InteractionPrompt {
  readonly key: string;
  readonly label: string;
}

/** The contextual prompt for the player's current position, or null when nothing is in range. */
export interface InteractionPromptSource {
  readonly world: PromptWorld;
  readonly x: number;
  readonly y: number;
  readonly items: readonly PromptTarget[];
  readonly reviveTarget?: { readonly id: string } | undefined;
  readonly lootChest?: { readonly id: string; readonly lootOwnerName?: string | undefined } | undefined;
  readonly pet?: PetPromptTarget | undefined;
}

export function resolveInteractionPrompt(source: InteractionPromptSource): InteractionPrompt | null {
  const { world, x, y, items, reviveTarget, lootChest, pet } = source;
  return stairwayPrompt(world, x, y)
    ?? revivePrompt(reviveTarget)
    ?? lootChestPrompt(lootChest)
    ?? petPrompt(pet)
    ?? nearbyWorldPrompt(world, x, y)
    ?? itemPrompt(items, x, y)
    ?? null;
}

function stairwayPrompt(world: PromptWorld, x: number, y: number): InteractionPrompt | undefined {
  const stairway = resolveStairwayPrompt(world, x, y);
  return stairway ? { key: "E", label: descentPromptLabel(stairway.direction, stairway.floor) } : undefined;
}

function revivePrompt(target: InteractionPromptSource["reviveTarget"]): InteractionPrompt | undefined {
  return target ? { key: "E", label: "hold to revive" } : undefined;
}

function petPrompt(pet: InteractionPromptSource["pet"]): InteractionPrompt | undefined {
  return pet && !pet.ownerName ? { key: "E", label: `adopt ${pet.name}` } : undefined;
}

function nearbyWorldPrompt(world: PromptWorld, x: number, y: number): InteractionPrompt | undefined {
  const target = resolveWorldInteraction(world, x, y);
  return target ? worldPrompt(target.kind) : undefined;
}

function itemPrompt(items: readonly PromptTarget[], x: number, y: number): InteractionPrompt | undefined {
  return hasNearbyItem(items, x, y) ? { key: "R", label: "pick up" } : undefined;
}

function lootChestPrompt(
  lootChest: { readonly id: string; readonly lootOwnerName?: string | undefined } | undefined,
): InteractionPrompt | undefined {
  if (!lootChest) return undefined;
  const label = lootChest.lootOwnerName ? `open [DEAD] ${lootChest.lootOwnerName}'s loot` : "open death loot";
  return { key: "E", label };
}
