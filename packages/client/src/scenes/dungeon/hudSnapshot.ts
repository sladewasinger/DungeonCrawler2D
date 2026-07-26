// Builds the HUD's per-frame snapshot from live Connection state — the "real" source
// hud/fakeData.ts's doc comment anticipates. Takes a narrow struct (not the whole
// Connection class) so it stays a pure, table-driven function to test.
import { displayCoordinates, type ActiveStatusSnapshot, type InvStack, type ServerSnapshot } from "@dc2d/engine";
import type { TouchVisualSnapshot } from "../../input/touch/index.js";
import { resolveContextualActionHelp } from "../../ui/actionHelp.js";
import type { ChatPanelModel } from "../../ui/chat/controller.js";
import type {
  BuffChipData,
  CraftSnapshot,
  HotbarSlotData,
  HudFakeSnapshot,
  InventoryRowData,
  StairwayTickData,
  StashSnapshot,
  TileCoords,
  ToastData,
} from "../../ui/widgets/hud/fakeData.js";
import type { ContactData } from "../../ui/widgets/hud/contactRows.js";
import type { BossBarData } from "../../ui/widgets/hud/bossBarView.js";
import { recipeRowViews } from "../../ui/widgets/hud/recipeRows.js";
import { stashRowViews } from "../../ui/widgets/hud/stashRows.js";
import {
  categoryOfItem,
  isConsumableItem,
  isThrowableItem,
  itemFlavor,
  itemName,
  recipeList,
} from "./contentQueries.js";
import type { InteractionPrompt } from "./interactionPrompt.js";
import { statusPresentations } from "../../ui/statusPresentation.js";
import { partyRowsView } from "./partyRows.js";

/** A stash entry as the wire/Connection shape carries it — item def id + qty, no index
 * (stashRowViews assigns the display index from array position). */
export interface StashSlotSource {
  readonly item: string;
  readonly qty: number;
}

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
      canUse: isConsumableItem(stack.item),
      canHotbar: isConsumableItem(stack.item) || isThrowableItem(stack.item),
      flavor: itemFlavor(stack.item),
    };
  });
}

/** Uses authoritative status timing when available and keeps `fx` as a legacy fallback. */
function buffChips(
  statusEffects: readonly ActiveStatusSnapshot[],
  fx: readonly string[],
): BuffChipData[] {
  return statusPresentations(statusEffects, fx).map((status) => ({
    statusId: status.id,
    kind: status.kind,
    remainingSec: status.remainingSeconds,
    durationSec: status.durationSeconds,
  }));
}

/** Rounds the predicted self body's raw tile position for the telemetry readout — x/y to
 * whole tiles ("so users can find each other or share positions" needs no float noise),
 * z to one decimal (docs/ROADMAP.md Epic 7.13's "z from conn.body.z, one decimal"). */
function roundedCoords(bodyPos: { x: number; y: number; z: number }): TileCoords {
  const display = displayCoordinates(bodyPos.x, bodyPos.y);
  return { x: Math.round(display.x), y: Math.round(display.y), z: Math.round(bodyPos.z * 10) / 10 };
}

/** Off-self party member rows for the party frames widget (Epic 7.12) — party is
 * null when unpartied, which naturally yields an empty (hidden) row list. */
/** Every recipe's have/need row against live inventory (Epic 7.12) — recipeList is
 * content-order, matching v1's craft-panel number-key ordering. */
export function craftSnapshot(inventory: readonly InvStack[], nearby: boolean): CraftSnapshot {
  return { nearby, recipes: recipeRowViews(recipeList, inventory, itemName) };
}

/** Both stash-window columns: your inventory (put source) and the stash (take source). */
export function stashSnapshot(
  inventory: readonly InvStack[],
  stash: readonly StashSlotSource[] | null,
  nearby: boolean,
  kind: "personal" | "loot" = "personal",
): StashSnapshot {
  return { kind, nearby, inventory: stashRowViews(inventory, itemName), entries: stashRowViews(stash ?? [], itemName) };
}

export interface HudSnapshotSource {
  readonly playerId: string | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly stamina: number; readonly maxStamina: number; readonly blocking: boolean;
  readonly staminaExhausted: boolean;
  /** Epic 11 core (character levels) — see fakeData.ts's HudFakeSnapshot.xp doc comment. */
  readonly xp: number;
  readonly level: number;
  readonly xpForNext: number;
  readonly hotbar: readonly (string | null)[];
  readonly inventory: readonly InvStack[];
  readonly weapon: string | null;
  readonly fx: readonly string[];
  readonly statusEffects: readonly ActiveStatusSnapshot[];
  readonly pingMs: number;
  readonly connected: boolean;
  readonly reconnecting: boolean;
  readonly reconnectAttempts: number;
  readonly downed: boolean;
  readonly dead: boolean;
  readonly party: ServerSnapshot["party"];
  /** Whether a crafting table / stash is within interact range of the self body right now —
   * drives the craft/stash windows' auto-close-on-walk-away (mirrors v1's Panels.sync). */
  readonly craftTableNearby: boolean;
  readonly stashNearby: boolean;
  /** The stash's current contents, or null before the first server "stash" event this session. */
  readonly stash: readonly StashSlotSource[] | null;
  readonly stashKind?: "personal" | "loot";
  /** The latest still-live server toast (net/apply.ts), or null — craft/stash windows'
   * result-feedback line (docs/ROADMAP.md Epic 7.12's "existing toast/system-line pattern"). */
  readonly lastToast: ToastData | null;
  /** Every still-tracked toast — see fakeData.ts's HudFakeSnapshot.toasts doc comment. */
  readonly toasts: readonly ToastData[];
  /** The connected world's seed, or null until the welcome message carries one. */
  readonly seed: string | null;
  /** Current dungeon floor (Epic 7.14). */
  readonly floor: number;
  /** The AOI boss entity, or null when none is nearby. */
  readonly boss: BossBarData | null;
}

/** Hotbar/inventory/craft/stash fields — split out so buildHudSnapshot itself stays under the function-length cap. */
function inventoryFields(
  src: HudSnapshotSource,
  selectedHotbarSlot: number | null,
  armedThrowableSlot: number | null,
) {
  const selectedItemId = selectedHotbarSlot === null
    ? null
    : src.hotbar[selectedHotbarSlot] ?? null;
  return {
    hotbar: hotbarSlots(src.hotbar, src.inventory),
    selectedSlot: selectedHotbarSlot ?? -1,
    armedThrowableSlot,
    buffs: buffChips(src.statusEffects, src.fx),
    equippedWeaponId: src.weapon,
    inventory: inventoryRows(src.inventory, src.hotbar),
    craft: craftSnapshot(src.inventory, src.craftTableNearby),
    stash: stashSnapshot(src.inventory, src.stash, src.stashNearby, src.stashKind),
    actionHints: resolveContextualActionHelp({
      selectedItemId,
      weaponId: src.weapon,
      canBlock: src.weapon !== null && src.stamina > 0 &&
        !src.staminaExhausted && !src.downed && !src.dead,
    }),
  };
}

/** Connection/telemetry fields — buildHudSnapshot's other length-cap split. */
function statusFields(
  src: HudSnapshotSource,
  touch: TouchVisualSnapshot | null,
  fps: number,
  bodyPos: { x: number; y: number; z: number },
  compassBearingDeg: number,
  stairway: StairwayTickData | null,
) {
  return {
    pingMs: src.pingMs,
    connected: src.connected,
    reconnecting: src.reconnecting,
    reconnectAttempts: src.reconnectAttempts,
    downed: src.downed,
    dead: src.dead,
    respawnRemainingSec: 0,
    respawnHoldProgress: 0,
    touch,
    fps,
    coords: roundedCoords(bodyPos),
    compassBearingDeg,
    stairway,
  };
}

export function buildHudSnapshot(
  src: HudSnapshotSource,
  selectedHotbarSlot: number | null,
  armedThrowableSlot: number | null,
  interactionPrompt: InteractionPrompt | null,
  touch: TouchVisualSnapshot | null,
  fps: number,
  bodyPos: { x: number; y: number; z: number },
  chatModel: ChatPanelModel,
  contacts: readonly ContactData[],
  compassBearingDeg: number,
  /** The compass dial's gold StairwayDown tick (LANE W) — see stairwayTick.ts. */
  stairway: StairwayTickData | null,
): HudFakeSnapshot {
  const party = partyRowsView(src.party, src.playerId, bodyPos, compassBearingDeg);
  return {
    health: { hp: src.hp, maxHp: src.maxHp },
    stamina: { stamina: src.stamina, maxStamina: src.maxStamina, blocking: src.blocking },
    xp: { xp: src.xp, level: src.level, xpForNext: src.xpForNext },
    ...inventoryFields(src, selectedHotbarSlot, armedThrowableSlot),
    lastToast: src.lastToast,
    toasts: [...src.toasts],
    seed: src.seed,
    floor: src.floor,
    biome: null,
    headingDeg: 0,
    boss: src.boss,
    party: party.rows,
    partySelfLeader: party.selfIsLeader,
    chatModel,
    contacts: [...contacts],
    interactionPrompt,
    ...statusFields(src, touch, fps, bodyPos, compassBearingDeg, stairway),
  };
}
