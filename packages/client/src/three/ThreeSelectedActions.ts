/** Resolves selected-item use and throw actions for the first-person renderer. */
import { MAX_THROW_RANGE, TILE, type World } from "@dc2d/engine";
import {
  isConsumableItem,
  isDoorNearby,
  isTileTypeNearby,
} from "../scenes/dungeon/contentQueries.js";
import { resolveStairwayPrompt } from "../scenes/dungeon/stairwayProximity.js";
import { isThrowableItem } from "../ui/itemCatalog.js";

export interface ThreeActionPort {
  readonly body: { x: number; y: number } | null;
  readonly hotbar: readonly (string | null)[];
  interact(): void;
  descend(): void;
  useSlot(slot: number, targetX?: number, targetY?: number): void;
  throwTorch(dirX: number, dirY: number): void;
}

const selectedItem = (
  connection: ThreeActionPort,
  slot: number | null,
): string | null => slot === null ? null : connection.hotbar[slot] ?? null;

const worldInteractionNearby = (
  connection: ThreeActionPort,
  world: World,
): boolean => {
  const body = connection.body;
  if (!body) return false;
  return isDoorNearby(world, body.x, body.y) ||
    isTileTypeNearby(world, TILE.Stash, body.x, body.y) ||
    isTileTypeNearby(world, TILE.CraftingTable, body.x, body.y);
};

export const useSelectedOrInteract = (
  connection: ThreeActionPort,
  world: World,
  slot: number | null,
): void => {
  const body = connection.body;
  if (!body) return;
  if (resolveStairwayPrompt(world, body.x, body.y)) {
    connection.descend();
    return;
  }
  if (worldInteractionNearby(connection, world)) {
    connection.interact();
    return;
  }
  const item = selectedItem(connection, slot);
  if (slot !== null && item && isConsumableItem(item)) {
    connection.useSlot(slot);
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
