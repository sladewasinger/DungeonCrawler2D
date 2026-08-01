import {
  INTERACT_RANGE,
  type WorldInteractionKind,
} from "@dc2d/engine";
import type Phaser from "phaser";
import type { InputConnection, InputPanels, InputQueries } from "../controls/state.js";

export interface InteractRequest {
  readonly conn: InputConnection;
  readonly panels: InputPanels;
  readonly queries: InputQueries;
  readonly selectedSlot: number | null;
  readonly startRevive: (targetId: string | undefined) => boolean;
  /** Touch uses contextual pickup only when its shared proximity query finds loot. */
  readonly pickupWhenNearby?: boolean;
}

export interface BandageBinding {
  readonly key: Phaser.Input.Keyboard.Key;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly selectedSlot: () => number | null;
  readonly fallbackDown: () => void;
  readonly fallbackUp: () => void;
  readonly blocked: () => boolean;
}

function useWorldInteraction(conn: InputConnection, panels: InputPanels, queries: InputQueries): boolean {
  const target = queries.worldInteraction(conn);
  if (!target) return false;
  worldInteractionAction(target.kind, conn, panels);
  return true;
}

function worldInteractionAction(
  kind: WorldInteractionKind,
  conn: InputConnection,
  panels: InputPanels,
): void {
  if (kind === "craft") return panels.toggleCraft(conn);
  if (kind === "stash") return openStash(conn, panels);
  conn.interact();
}

function openStash(conn: InputConnection, panels: InputPanels): void {
  if (panels.toggleStash(conn)) conn.interact();
}

function useLootChest(conn: InputConnection, panels: InputPanels, queries: InputQueries): boolean {
  const chest = queries.nearbyLootChest(conn);
  if (!chest) return false;
  conn.lootChestOp(chest.id, "open");
  if (chest.canOpen) panels.toggleStash(conn);
  return true;
}

function useSelectedConsumable(conn: InputConnection, queries: InputQueries, selectedSlot: number | null): boolean {
  const item = selectedSlot === null ? undefined : conn.hotbar[selectedSlot];
  if (selectedSlot === null || !item || !queries.isConsumable(item)) return false;
  conn.useSlot(selectedSlot);
  return true;
}

function useFallback(
  conn: InputConnection,
  queries: InputQueries,
  pickupWhenNearby: boolean,
): void {
  if (pickupWhenNearby && queries.isPickupNearby(conn)) return conn.pickup();
  conn.pushToast("Nothing to interact with here");
  conn.interact();
}

/** E priority: stairs/revive/world interaction first, then the selected consumable. */
export function interactOrUse(request: InteractRequest): void {
  const { conn, queries, selectedSlot, pickupWhenNearby = false } = request;
  if (useMovementOrRevive(request)) return;
  if (useNearbyWorldContext(request)) return;
  if (useSelectedConsumable(conn, queries, selectedSlot)) return;
  useFallback(conn, queries, pickupWhenNearby);
}

function useMovementOrRevive({ conn, queries, startRevive }: InteractRequest): boolean {
  if (queries.isStairwayNearby(conn)) {
    conn.descend();
    return true;
  }
  return startRevive(queries.downedPartyMemberInRange(conn)?.id);
}

function useNearbyWorldContext({ conn, panels, queries }: InteractRequest): boolean {
  if (useLootChest(conn, panels, queries)) return true;
  if (queries.isAdoptablePetNearby(conn)) {
    conn.interact();
    return true;
  }
  return useWorldInteraction(conn, panels, queries);
}

/** F applies the selected bandage to the nearest player in interaction range. */
export function bandageNearbyPlayer(conn: InputConnection, queries: InputQueries, selectedSlot: number | null): boolean {
  if (selectedSlot === null || conn.hotbar[selectedSlot] !== "bandage") return false;
  if (!conn.inventory.some((stack) => stack.item === "bandage" && stack.qty > 0)) return false;
  const targetId = queries.nearestPlayerId(conn, INTERACT_RANGE);
  if (!targetId) return false;
  conn.useSlotOnPlayer(selectedSlot, targetId);
  return true;
}

export function bindBandageKey(binding: BandageBinding): void {
  const { key, conn, queries, selectedSlot, fallbackDown, fallbackUp, blocked } = binding;
  let handled = false;
  key.on("down", () => {
    if (blocked() || handled) return;
    handled = bandageNearbyPlayer(conn, queries, selectedSlot());
    if (!handled) fallbackDown();
  });
  key.on("up", () => {
    if (!handled) return fallbackUp();
    handled = false;
  });
}
