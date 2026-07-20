// Builds the HUD's per-frame snapshot from live Connection state — the "real" source
// hud/fakeData.ts's doc comment anticipates. Takes a narrow struct (not the whole
// Connection class) so it stays a pure, table-driven function to test.
import { statusesData } from "@dc2d/content";
import type { InvStack } from "@dc2d/engine";
import type { TouchVisualSnapshot } from "../../input/touch/index.js";
import type { ChatPanelModel } from "../../ui/chat/controller.js";
import type {
  BuffChipData,
  HotbarSlotData,
  HudFakeSnapshot,
  InventoryRowData,
  TileCoords,
} from "../../ui/widgets/hud/fakeData.js";
import type { ContactData } from "../../ui/widgets/hud/contactRows.js";
import { categoryOfItem, itemName } from "./contentQueries.js";
import type { InteractionPrompt } from "./interactionPrompt.js";

interface StatusDef {
  readonly id: string;
  readonly kind: "buff" | "debuff";
  readonly duration: number;
}

function isStatusDef(value: unknown): value is StatusDef {
  const record = value as Partial<StatusDef>;
  return typeof record?.id === "string" && (record.kind === "buff" || record.kind === "debuff");
}

const statusById = new Map<string, StatusDef>(
  (statusesData as readonly unknown[]).filter(isStatusDef).map((def) => [def.id, def]),
);

function hotbarSlots(hotbar: readonly (string | null)[], inventory: readonly InvStack[]): HotbarSlotData[] {
  return hotbar.map((itemId) => {
    if (!itemId) return { itemId: null, count: 0 };
    const stack = inventory.find((s) => s.item === itemId);
    return { itemId, count: stack?.qty ?? 0 };
  });
}

/** One row per InvStack — hotbarSlots()'s sibling for the inventory window, sourced from the same intent state. */
function inventoryRows(inventory: readonly InvStack[], hotbar: readonly (string | null)[]): InventoryRowData[] {
  return inventory.map((stack) => {
    const boundIndex = hotbar.indexOf(stack.item);
    return {
      itemId: stack.item,
      name: itemName(stack.item),
      qty: stack.qty,
      category: categoryOfItem(stack.item),
      boundSlot: boundIndex >= 0 ? boundIndex : null,
    };
  });
}

/** The hotbar slot holding the currently equipped weapon, or -1 (no highlight) when unarmed. */
function selectedSlotIndex(hotbar: readonly (string | null)[], weapon: string | null): number {
  return weapon ? hotbar.indexOf(weapon) : -1;
}

/**
 * The server only sends active status ids, never remaining duration
 * (selfSnapshotSchema.fx is `string[]`) — each chip renders a full pip at
 * the status's authored duration rather than a fabricated countdown.
 */
function buffChips(fx: readonly string[]): BuffChipData[] {
  return fx.map((statusId) => {
    const def = statusById.get(statusId);
    const durationSec = def?.duration ?? 1;
    return { statusId, kind: def?.kind ?? "debuff", remainingSec: durationSec, durationSec };
  });
}

/** Rounds the predicted self body's raw tile position for the top-right coords readout —
 * "so users can find each other or share positions" only needs whole tiles, not float noise. */
function roundedCoords(bodyPos: { x: number; y: number }): TileCoords {
  return { x: Math.round(bodyPos.x), y: Math.round(bodyPos.y) };
}

export interface HudSnapshotSource {
  readonly hp: number;
  readonly maxHp: number;
  readonly hotbar: readonly (string | null)[];
  readonly inventory: readonly InvStack[];
  readonly weapon: string | null;
  readonly fx: readonly string[];
  readonly pingMs: number;
  readonly connected: boolean;
  readonly reconnecting: boolean;
  readonly downed: boolean;
}

export function buildHudSnapshot(
  src: HudSnapshotSource,
  armedThrowableSlot: number | null,
  interactionPrompt: InteractionPrompt | null,
  touch: TouchVisualSnapshot | null,
  fps: number,
  bodyPos: { x: number; y: number },
  chatModel: ChatPanelModel,
  contacts: readonly ContactData[],
): HudFakeSnapshot {
  return {
    health: { hp: src.hp, maxHp: src.maxHp },
    hotbar: hotbarSlots(src.hotbar, src.inventory),
    selectedSlot: selectedSlotIndex(src.hotbar, src.weapon),
    armedThrowableSlot,
    buffs: buffChips(src.fx),
    equippedWeaponId: src.weapon,
    inventory: inventoryRows(src.inventory, src.hotbar),
    chatModel,
    contacts: [...contacts],
    interactionPrompt,
    pingMs: src.pingMs,
    connected: src.connected,
    reconnecting: src.reconnecting,
    downed: src.downed,
    touch,
    fps,
    coords: roundedCoords(bodyPos),
  };
}
