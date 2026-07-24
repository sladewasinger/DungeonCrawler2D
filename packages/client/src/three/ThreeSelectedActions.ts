/** Resolves selected-item use and throw actions for the first-person renderer. */
import { MAX_THROW_RANGE, resolveWorldInteraction, type World } from "@dc2d/engine";
import { isConsumableItem } from "../scenes/dungeon/contentQueries.js";
import { resolveStairwayPrompt } from "../scenes/dungeon/stairwayProximity.js";
import { isThrowableItem } from "../ui/itemCatalog.js";

export interface ThreeActionPort {
  readonly body: { x: number; y: number } | null;
  readonly hotbar: readonly (string | null)[];
  interact(): void;
  pickup(): void;
  descend(): void;
  useSlot(slot: number, targetX?: number, targetY?: number): void;
  throwTorch(dirX: number, dirY: number): void;
}

export interface ThreeInteractionPanels {
  toggleCraft(): void;
  toggleStash(): boolean;
}

const useWorldTarget = (
  target: ReturnType<typeof resolveWorldInteraction>,
  connection: ThreeActionPort,
  panels?: ThreeInteractionPanels,
): boolean => {
  if (!target) return false;
  if (target.kind === "craft" && panels) {
    panels.toggleCraft();
    return true;
  }
  if (target.kind === "stash" && panels) {
    if (panels.toggleStash()) connection.interact();
    return true;
  }
  connection.interact();
  return true;
};

const selectedItem = (
  connection: ThreeActionPort,
  slot: number | null,
): string | null => slot === null ? null : connection.hotbar[slot] ?? null;

export const useSelectedOrInteract = (
  connection: ThreeActionPort,
  world: World,
  slot: number | null,
  panels?: ThreeInteractionPanels,
  pickupNearby = false,
): void => {
  const body = connection.body;
  if (!body) return;
  if (resolveStairwayPrompt(world, body.x, body.y)) {
    connection.descend();
    return;
  }
  const target = resolveWorldInteraction(world, body.x, body.y);
  if (useWorldTarget(target, connection, panels)) return;
  const item = selectedItem(connection, slot);
  if (slot !== null && item && isConsumableItem(item)) {
    connection.useSlot(slot);
    return;
  }
  if (pickupNearby) {
    connection.pickup();
    return;
  }
  connection.interact();
};

export const throwSelectedItem = (
  connection: ThreeActionPort,
  slot: number | null,
  yaw: number,
): void => {
  const body = connection.body;
  const item = selectedItem(connection, slot);
  if (!body || slot === null || !item || !isThrowableItem(item)) return;
  const dirX = -Math.sin(yaw);
  const dirY = -Math.cos(yaw);
  if (item === "torch") {
    connection.throwTorch(dirX, dirY);
    return;
  }
  connection.useSlot(
    slot,
    body.x + dirX * MAX_THROW_RANGE,
    body.y + dirY * MAX_THROW_RANGE,
  );
};
