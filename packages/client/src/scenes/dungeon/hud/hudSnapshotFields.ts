import { displayCoordinates, type ActiveStatusSnapshot, type InvStack } from "@dc2d/engine";
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import { resolveContextualActionHelp } from "../../../ui/actionHelp/actionHelp.js";
import { statusPresentations } from "../../../ui/presentation/statusPresentation.js";
import { type BuffChipData, type HotbarSlotData, type InventoryRowData, type StairwayTickData, type TileCoords } from "../../../ui/widgets/hud/core/fakeData.js";
import { recipeRowViews } from "../../../ui/widgets/hud/windows/recipeRows.js";
import { stashRowViews } from "../../../ui/widgets/hud/windows/stashRows.js";
import { categoryOfItem, isConsumableItem, isThrowableItem, itemFlavor, itemName, recipeList } from "../world/contentQueries.js";
import type { HudSnapshotSource } from "./hudSnapshot.js";

function hotbarSlots(hotbar: readonly (string | null)[], inventory: readonly InvStack[]): HotbarSlotData[] {
  return hotbar.map((itemId) => {
    if (!itemId) return { itemId: null, count: 0 };
    return { itemId, count: inventory.find((stack) => stack.item === itemId)?.qty ?? 0 };
  });
}

function inventoryRows(inventory: readonly InvStack[], hotbar: readonly (string | null)[]): InventoryRowData[] {
  return inventory.map((stack) => {
    const boundIndex = hotbar.indexOf(stack.item);
    return { itemId: stack.item, name: itemName(stack.item), qty: stack.qty, category: categoryOfItem(stack.item), boundSlot: boundIndex >= 0 ? boundIndex : null, canUse: isConsumableItem(stack.item), canHotbar: isConsumableItem(stack.item) || isThrowableItem(stack.item), flavor: itemFlavor(stack.item) };
  });
}

function buffChips(statusEffects: readonly ActiveStatusSnapshot[], fx: readonly string[]): BuffChipData[] {
  return statusPresentations(statusEffects, fx).map((status) => ({ statusId: status.id, kind: status.kind, remainingSec: status.remainingSeconds, durationSec: status.durationSeconds }));
}

export function inventoryFields(src: HudSnapshotSource, selectedHotbarSlot: number | null, armedThrowableSlot: number | null) {
  const selectedItemId = selectedItem(src.hotbar, selectedHotbarSlot);
  return {
    hotbar: hotbarSlots(src.hotbar, src.inventory), selectedSlot: selectedHotbarSlot ?? -1, armedThrowableSlot,
    buffs: buffChips(src.statusEffects, src.fx), equippedWeaponId: src.weapon, inventory: inventoryRows(src.inventory, src.hotbar),
    craft: craftFields(src), stash: stashFields(src), actionHints: actionHints(src, selectedItemId),
  };
}

function selectedItem(hotbar: readonly (string | null)[], selectedSlot: number | null): string | null {
  return selectedSlot === null ? null : hotbar[selectedSlot] ?? null;
}

function craftFields(src: HudSnapshotSource) {
  return { nearby: src.craftTableNearby, recipes: recipeRowViews(recipeList, src.inventory, itemName) };
}

function stashFields(src: HudSnapshotSource) {
  return { kind: src.stashKind ?? "personal", nearby: src.stashNearby, inventory: stashRowViews(src.inventory, itemName), entries: stashRowViews(src.stash ?? [], itemName) };
}

function actionHints(src: HudSnapshotSource, selectedItemId: string | null) {
  return resolveContextualActionHelp({ selectedItemId, weaponId: src.weapon, canBlock: canBlock(src) });
}

function canBlock(src: HudSnapshotSource): boolean {
  return src.weapon !== null && src.stamina > 0 && !src.staminaExhausted && !src.downed && !src.dead;
}

interface HudStatusInput {
  readonly src: HudSnapshotSource;
  readonly touch: TouchVisualSnapshot | null;
  readonly fps: number;
  readonly bodyPos: { x: number; y: number; z: number };
  readonly compassBearingDeg: number;
  readonly stairway: StairwayTickData | null;
}

function roundedCoords(bodyPos: { x: number; y: number; z: number }): TileCoords {
  const display = displayCoordinates(bodyPos.x, bodyPos.y);
  return { x: Math.round(display.x), y: Math.round(display.y), z: Math.round(bodyPos.z * 10) / 10 };
}

export function statusFields(input: HudStatusInput) {
  const { src, touch, fps, bodyPos, compassBearingDeg, stairway } = input;
  return { pingMs: src.pingMs, connected: src.connected, reconnecting: src.reconnecting, reconnectAttempts: src.reconnectAttempts, downed: src.downed, dead: src.dead, respawnRemainingSec: 0, giveUpHoldProgress: 0, downedRemainingSec: 0, reviveProgress: 0, reviverName: null, touch, fps, coords: roundedCoords(bodyPos), compassBearingDeg, stairway };
}
