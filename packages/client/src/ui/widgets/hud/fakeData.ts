/** Fake HUD data for the gallery's HUD-on state — a presentation demo, not live game state. */
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import { isTouchDevice } from "../../../input/touchDetect.js";

export interface HotbarSlotData {
  itemId: string | null;
  count: number;
}

export interface BuffChipData {
  statusId: string;
  kind: "buff" | "debuff";
  remainingSec: number;
  durationSec: number;
}

export type ChatChannel = "local" | "party";

export interface ChatLineData {
  channel: ChatChannel;
  author: string;
  text: string;
}

/** Inventory filter-tab category — mirrors inventoryRows.ts's InventoryTabId minus "all". */
export type InventoryCategory = "weapons" | "usables" | "materials";

/** One inventory row's display data: hotbarSlots.ts's sibling for the inventory window. */
export interface InventoryRowData {
  itemId: string;
  name: string;
  qty: number;
  category: InventoryCategory;
  /** Hotbar index this item is bound to, or null when unbound. */
  boundSlot: number | null;
}

/** A tile-space (x, y) — the player's rounded predicted position for the top-right coords readout. */
export interface TileCoords {
  x: number;
  y: number;
}

export interface HudFakeSnapshot {
  health: { hp: number; maxHp: number };
  hotbar: HotbarSlotData[];
  selectedSlot: number;
  armedThrowableSlot: number | null;
  buffs: BuffChipData[];
  equippedWeaponId: string | null;
  /** Every inventory stack the inventory window renders — independent of the 9 hotbar slots above. */
  inventory: InventoryRowData[];
  chat: ChatLineData[];
  activeChatChannel: ChatChannel;
  interactionPrompt: { key: string; label: string } | null;
  pingMs: number;
  connected: boolean;
  /** True while a previously-live connection is mid dropout/backoff (see net/socket.ts). */
  reconnecting: boolean;
  downed: boolean;
  /** Live joystick/button state for the touch widgets, or null when touch controls aren't mounted. */
  touch: TouchVisualSnapshot | null;
  /** Raw per-frame render fps (Phaser's game.loop.actualFps) — the top-right indicator smooths this itself. */
  fps: number;
  /** Player's rounded predicted tile position, for the top-right coords readout. */
  coords: TileCoords;
}

const EMPTY_SLOT: HotbarSlotData = { itemId: null, count: 0 };

/**
 * Ten sample stacks spanning all three categories (4 weapons/4 usables/2 materials) —
 * more than the inventory window's ~8-row cap so the gallery harness also proves the
 * "cap visible rows, no scroll region yet" behavior, not just the tab filters.
 */
const FAKE_INVENTORY: InventoryRowData[] = [
  { itemId: "sword", name: "Rusty Sword", qty: 1, category: "weapons", boundSlot: 0 },
  { itemId: "knife", name: "Knife", qty: 1, category: "weapons", boundSlot: null },
  { itemId: "hammer", name: "Heavy Hammer", qty: 1, category: "weapons", boundSlot: 4 },
  { itemId: "torch", name: "Torch", qty: 2, category: "weapons", boundSlot: null },
  { itemId: "bandage", name: "Bandage", qty: 3, category: "usables", boundSlot: 1 },
  { itemId: "water-flask", name: "Water Flask", qty: 2, category: "usables", boundSlot: 2 },
  { itemId: "vodka-bottle", name: "Vodka Bottle", qty: 1, category: "usables", boundSlot: 3 },
  { itemId: "raw-meat", name: "Raw Meat", qty: 4, category: "usables", boundSlot: null },
  { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null },
  { itemId: "stick", name: "Stick", qty: 5, category: "materials", boundSlot: null },
];

/** Static fake snapshot: half health, 5 filled hotbar slots (one armed throwable), 2 buffs, one chat line per channel. */
export function fakeHudSnapshot(downed: boolean): HudFakeSnapshot {
  return {
    health: { hp: 24, maxHp: 48 },
    hotbar: [
      { itemId: "sword", count: 1 },
      { itemId: "bandage", count: 3 },
      { itemId: "water-flask", count: 2 },
      { itemId: "vodka-bottle", count: 1 },
      { itemId: "hammer", count: 1 },
      EMPTY_SLOT,
      EMPTY_SLOT,
      EMPTY_SLOT,
      EMPTY_SLOT,
    ],
    selectedSlot: 0,
    armedThrowableSlot: 3,
    buffs: [
      { statusId: "on-fire", kind: "debuff", remainingSec: 3.2, durationSec: 5 },
      { statusId: "regenerating", kind: "buff", remainingSec: 12, durationSec: 20 },
    ],
    equippedWeaponId: "sword",
    inventory: FAKE_INVENTORY,
    chat: [
      { channel: "local", author: "Wren", text: "watch the spikes" },
      { channel: "party", author: "you", text: "grabbed the key" },
    ],
    activeChatChannel: "local",
    interactionPrompt: { key: "R", label: "pick up" },
    pingMs: 42,
    connected: true,
    reconnecting: false,
    downed,
    touch: isTouchDevice() ? { stick: null, buttons: { attack: false, jump: false, interact: false } } : null,
    fps: 60,
    coords: { x: 128, y: -64 },
  };
}
