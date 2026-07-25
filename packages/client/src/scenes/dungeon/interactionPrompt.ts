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

function hasNearbyItem(items: readonly PromptTarget[], x: number, y: number): boolean {
  return items.some((item) => Math.hypot(item.x - x, item.y - y) <= PICKUP_RANGE);
}

const worldPrompt = (kind: WorldInteractionKind): InteractionPrompt => {
  if (kind === "door") return { key: "E", label: "enter" };
  if (kind === "stash") return { key: "E", label: "open stash" };
  return { key: "E", label: "craft" };
};

export interface InteractionPrompt {
  readonly key: string;
  readonly label: string;
}

/** The contextual prompt for the player's current position, or null when nothing is in range. */
export function resolveInteractionPrompt(
  world: PromptWorld,
  x: number,
  y: number,
  items: readonly PromptTarget[],
  reviveTarget?: { readonly id: string },
): InteractionPrompt | null {
  const stairway = resolveStairwayPrompt(world, x, y);
  if (stairway) return { key: "E", label: descentPromptLabel(stairway.direction, stairway.floor) };
  if (reviveTarget) return { key: "E", label: "hold to revive" };
  const worldTarget = resolveWorldInteraction(world, x, y);
  if (worldTarget) return worldPrompt(worldTarget.kind);
  if (hasNearbyItem(items, x, y)) return { key: "R", label: "pick up" };
  return null;
}
