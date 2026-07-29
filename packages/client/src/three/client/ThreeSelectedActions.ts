/** Resolves selected-item use and throw actions for the first-person renderer. */
import { MAX_THROW_RANGE, resolveWorldInteraction, type World } from "@dc2d/engine";
import { isConsumableItem } from "../../scenes/dungeon/world/contentQueries.js";
import { resolveStairwayPrompt } from "../../scenes/dungeon/world/stairwayProximity.js";
import { isThrowableItem } from "../../ui/presentation/itemCatalog.js";

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

export interface SelectedInteraction {
  readonly connection: ThreeActionPort;
  readonly world: World;
  readonly slot: number | null;
  readonly panels?: ThreeInteractionPanels | undefined;
  readonly pickupNearby?: boolean;
}

const useWorldTarget = (
  target: ReturnType<typeof resolveWorldInteraction>,
  connection: ThreeActionPort,
  panels?: ThreeInteractionPanels,
): boolean => {
  if (!target) return false;
  if (panels && usePanelTarget(target.kind, panels, connection)) return true;
  connection.interact();
  return true;
};

function usePanelTarget(
  kind: NonNullable<ReturnType<typeof resolveWorldInteraction>>["kind"],
  panels: ThreeInteractionPanels,
  connection: ThreeActionPort,
): boolean {
  const actions: Partial<Record<typeof kind, () => boolean>> = {
    craft: () => { panels.toggleCraft(); return true; },
    stash: () => { if (panels.toggleStash()) connection.interact(); return true; },
  };
  return actions[kind]?.() ?? false;
}

const selectedItem = (
  connection: ThreeActionPort,
  slot: number | null,
): string | null => slot === null ? null : connection.hotbar[slot] ?? null;

export const useSelectedOrInteract = ({ connection, world, slot, panels, pickupNearby = false }: SelectedInteraction): void => {
  const body = connection.body;
  if (!body) return;
  if (useLocationInteraction({ connection, world, panels, body })) return;
  useItemOrFallback({ connection, slot, pickupNearby });
};

function useLocationInteraction({ connection, world, panels, body }: {
  readonly connection: ThreeActionPort;
  readonly world: World;
  readonly panels?: ThreeInteractionPanels | undefined;
  readonly body: NonNullable<ThreeActionPort["body"]>;
}): boolean {
  if (resolveStairwayPrompt(world, body.x, body.y)) {
    connection.descend();
    return true;
  }
  return useWorldTarget(resolveWorldInteraction(world, body.x, body.y), connection, panels);
}

function useItemOrFallback({ connection, slot, pickupNearby }: Pick<SelectedInteraction, "connection" | "slot" | "pickupNearby">): void {
  const item = selectedItem(connection, slot);
  if (slot !== null && item && isConsumableItem(item)) return connection.useSlot(slot);
  if (pickupNearby) return connection.pickup();
  connection.interact();
}

export const throwSelectedItem = (
  connection: ThreeActionPort,
  slot: number | null,
  yaw: number,
): void => {
  const item = selectedItem(connection, slot);
  if (!canThrowSelected(connection.body, slot, item)) return;
  const body = connection.body;
  if (!body || slot === null) return;
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

function canThrowSelected(body: ThreeActionPort["body"], slot: number | null, item: string | null): boolean {
  return body !== null && slot !== null && item !== null && isThrowableItem(item);
}
