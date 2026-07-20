/** Fake HUD data for the gallery's HUD-on state — a presentation demo, not live game state. */
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import { isTouchDevice } from "../../../input/touchDetect.js";
import type { ChatPanelModel } from "../../chat/controller.js";
import type { ContactData } from "./contactRows.js";
import type { PartyRowData } from "./partyFrames.js";
import type { BossBarData } from "./bossBarView.js";
import type { RecipeRowView } from "./recipeRows.js";
import type { StashRowView } from "./stashRows.js";
import type { XpBarData } from "./xpBarView.js";

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
  /** Content's short flavor line (Epic 7.14 §4), undefined for a def that has none. */
  flavor?: string | undefined;
}

/** A tile-space (x, y, z) — the player's rounded predicted position for the top-right
 * telemetry readout; z stays a float (one decimal) since height rarely lands on a whole tile. */
export interface TileCoords {
  x: number;
  y: number;
  z: number;
}

/** The crafting window's per-frame data: whether a crafting table is in range (auto-closes
 * the window when it stops being true, mirroring v1's Panels.sync) and every recipe's
 * resolved have/need row. */
export interface CraftSnapshot {
  nearby: boolean;
  recipes: RecipeRowView[];
}

/** The stash window's per-frame data: range gate plus both columns' rows. */
export interface StashSnapshot {
  nearby: boolean;
  inventory: StashRowView[];
  entries: StashRowView[];
}

/** A still-live server toast (net/apply.ts's "toast" event) — craft/stash windows show
 * the latest one as their result-feedback line while `until` hasn't elapsed. */
export interface ToastData {
  msg: string;
  until: number;
}

export interface HudFakeSnapshot {
  health: { hp: number; maxHp: number };
  /** Epic 11 core (character levels), pulled forward — xpBar.ts's progress bar + level numeral. */
  xp: XpBarData;
  hotbar: HotbarSlotData[];
  selectedSlot: number;
  armedThrowableSlot: number | null;
  buffs: BuffChipData[];
  equippedWeaponId: string | null;
  /** Every inventory stack the inventory window renders — independent of the 9 hotbar slots above. */
  inventory: InventoryRowData[];
  craft: CraftSnapshot;
  stash: StashSnapshot;
  lastToast: ToastData | null;
  /** Every still-tracked toast (net/apply.ts + Connection.pushToast) — the top-center
   * toastStack.ts widget's full queue, independent of lastToast's single-line consumers. */
  toasts: ToastData[];
  /** The connected world's seed, for the telemetry stack — from the welcome handshake. */
  seed: string | null;
  /** Current dungeon floor (Epic 7.14), for the telemetry stack + HUD numeral. */
  floor: number;
  /** The AOI boss entity (Epic 7.14), or null when none is nearby — hides the bar. */
  boss: BossBarData | null;
  /** Off-self party member rows (Epic 7.12) — empty when unpartied, hides the widget. */
  party: PartyRowData[];
  chatModel: ChatPanelModel;
  contacts: ContactData[];
  interactionPrompt: { key: string; label: string } | null;
  pingMs: number;
  connected: boolean;
  /** True while a previously-live connection is mid dropout/backoff (see net/socket.ts). */
  reconnecting: boolean;
  /** Consecutive failed reconnect attempts (net/socket.ts) — the toast's "(attempt N)" suffix. */
  reconnectAttempts: number;
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
  { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null, flavor: "Absorbent. Slightly cursed. Mostly the first thing." },
  { itemId: "stick", name: "Stick", qty: 5, category: "materials", boundSlot: null, flavor: "The dungeon's starter weapon, technically. Don't." },
];

/** One tab per channel, global unread and dm dimmed (not yet seen) — proves both states at once. */
const FAKE_CHAT_MODEL: ChatPanelModel = {
  tabs: [
    { id: "global", active: false, unread: true, dim: false },
    { id: "local", active: true, unread: false, dim: false },
    { id: "party", active: false, unread: false, dim: false },
    { id: "dm", active: false, unread: false, dim: true },
  ],
  lines: [
    { channel: "local", author: "Wren", text: "watch the spikes" },
    // Deliberately announcer-length: proves the word-wrap + bottom-up restack.
    { channel: "local", author: "system", text: "Crawler #2 has entered Floor 1. Odds of survival have been posted." },
    { channel: "party", author: "you", text: "grabbed the key" },
  ],
};

const FAKE_CONTACTS: ContactData[] = [
  { name: "Wren", online: true },
  { name: "Rex", online: false },
];

/** One healthy ally, one downed — proves both party-row states at once. */
const FAKE_PARTY: PartyRowData[] = [
  { id: "p2", name: "Wren", hp: 22, maxHp: 30, downed: false },
  { id: "p3", name: "Rex", hp: 1, maxHp: 30, downed: true },
];

/** One craftable recipe (rag on hand) and one short a stick — proves both button states at once. */
const FAKE_CRAFT: CraftSnapshot = {
  nearby: true,
  recipes: [
    {
      recipeId: "bandage",
      outputId: "bandage",
      outputName: "Bandage",
      outputQty: 1,
      ingredients: [{ itemId: "rag", name: "Rag", have: 6, need: 2, met: true }],
      craftable: true,
    },
    {
      recipeId: "torch",
      outputId: "torch",
      outputName: "Torch",
      outputQty: 1,
      ingredients: [
        { itemId: "stick", name: "Stick", have: 0, need: 1, met: false },
        { itemId: "rag", name: "Rag", have: 6, need: 1, met: true },
      ],
      craftable: false,
    },
  ],
};

const FAKE_STASH: StashSnapshot = {
  nearby: true,
  inventory: [
    { index: 0, itemId: "sword", name: "Rusty Sword", qty: 1 },
    { index: 1, itemId: "rag", name: "Rag", qty: 6 },
  ],
  entries: [{ index: 0, itemId: "bandage", name: "Bandage", qty: 2 }],
};

/** 5 filled hotbar slots (one armed throwable) + 4 empty — fakeHudSnapshot()'s own sibling to FAKE_INVENTORY etc. */
const FAKE_HOTBAR: HotbarSlotData[] = [
  { itemId: "sword", count: 1 },
  { itemId: "bandage", count: 3 },
  { itemId: "water-flask", count: 2 },
  { itemId: "vodka-bottle", count: 1 },
  { itemId: "hammer", count: 1 },
  EMPTY_SLOT,
  EMPTY_SLOT,
  EMPTY_SLOT,
  EMPTY_SLOT,
];

const FAKE_BUFFS: BuffChipData[] = [
  { statusId: "on-fire", kind: "debuff", remainingSec: 3.2, durationSec: 5 },
  { statusId: "regenerating", kind: "buff", remainingSec: 12, durationSec: 20 },
];

/** Static fake snapshot: half health, 5 filled hotbar slots (one armed throwable), 2 buffs, one chat line per channel. */
export function fakeHudSnapshot(downed: boolean): HudFakeSnapshot {
  return {
    health: { hp: 24, maxHp: 48 },
    xp: { xp: 220, level: 3, xpForNext: 80 },
    hotbar: FAKE_HOTBAR,
    selectedSlot: 0,
    armedThrowableSlot: 3,
    buffs: FAKE_BUFFS,
    equippedWeaponId: "sword",
    inventory: FAKE_INVENTORY,
    craft: FAKE_CRAFT,
    stash: FAKE_STASH,
    lastToast: null,
    toasts: [],
    seed: "e2e-world",
    floor: 1,
    boss: null,
    party: FAKE_PARTY,
    chatModel: FAKE_CHAT_MODEL,
    contacts: FAKE_CONTACTS,
    interactionPrompt: { key: "R", label: "pick up" },
    pingMs: 42,
    connected: true,
    reconnecting: false,
    reconnectAttempts: 0,
    downed,
    touch: isTouchDevice() ? { stick: null, buttons: { attack: false, jump: false, interact: false } } : null,
    fps: 60,
    coords: { x: 128, y: -64, z: 2.5 },
  };
}
