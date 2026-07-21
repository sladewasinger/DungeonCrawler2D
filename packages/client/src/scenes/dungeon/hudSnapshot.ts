// Builds the HUD's per-frame snapshot from live Connection state — the "real" source
// hud/fakeData.ts's doc comment anticipates. Takes a narrow struct (not the whole
// Connection class) so it stays a pure, table-driven function to test.
import { statusesData } from "@dc2d/content";
import type { InvStack, ServerSnapshot } from "@dc2d/engine";
import type { TouchVisualSnapshot } from "../../input/touch/index.js";
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
import type { PartyRowData } from "../../ui/widgets/hud/partyFrames.js";
import type { BossBarData } from "../../ui/widgets/hud/bossBarView.js";
import { recipeRowViews } from "../../ui/widgets/hud/recipeRows.js";
import { stashRowViews } from "../../ui/widgets/hud/stashRows.js";
import { categoryOfItem, itemFlavor, itemName, recipeList } from "./contentQueries.js";
import type { InteractionPrompt } from "./interactionPrompt.js";

/** A stash entry as the wire/Connection shape carries it — item def id + qty, no index
 * (stashRowViews assigns the display index from array position). */
export interface StashSlotSource {
  readonly item: string;
  readonly qty: number;
}

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
      flavor: itemFlavor(stack.item),
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

/** Rounds the predicted self body's raw tile position for the telemetry readout — x/y to
 * whole tiles ("so users can find each other or share positions" needs no float noise),
 * z to one decimal (docs/ROADMAP.md Epic 7.13's "z from conn.body.z, one decimal"). */
function roundedCoords(bodyPos: { x: number; y: number; z: number }): TileCoords {
  return { x: Math.round(bodyPos.x), y: Math.round(bodyPos.y), z: Math.round(bodyPos.z * 10) / 10 };
}

/** Off-self party member rows for the party frames widget (Epic 7.12) — party is
 * null when unpartied, which naturally yields an empty (hidden) row list. */
function partyRows(party: ServerSnapshot["party"]): PartyRowData[] {
  if (!party) return [];
  return party.members.map((m) => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, downed: m.downed }));
}

/** Every recipe's have/need row against live inventory (Epic 7.12) — recipeList is
 * content-order, matching v1's craft-panel number-key ordering. */
function craftSnapshot(inventory: readonly InvStack[], nearby: boolean): CraftSnapshot {
  return { nearby, recipes: recipeRowViews(recipeList, inventory, itemName) };
}

/** Both stash-window columns: your inventory (put source) and the stash (take source). */
function stashSnapshot(inventory: readonly InvStack[], stash: readonly StashSlotSource[] | null, nearby: boolean): StashSnapshot {
  return { nearby, inventory: stashRowViews(inventory, itemName), entries: stashRowViews(stash ?? [], itemName) };
}

export interface HudSnapshotSource {
  readonly hp: number;
  readonly maxHp: number;
  /** Epic 11 core (character levels) — see fakeData.ts's HudFakeSnapshot.xp doc comment. */
  readonly xp: number;
  readonly level: number;
  readonly xpForNext: number;
  readonly hotbar: readonly (string | null)[];
  readonly inventory: readonly InvStack[];
  readonly weapon: string | null;
  readonly fx: readonly string[];
  readonly pingMs: number;
  readonly connected: boolean;
  readonly reconnecting: boolean;
  readonly reconnectAttempts: number;
  readonly downed: boolean;
  readonly party: ServerSnapshot["party"];
  /** Whether a crafting table / stash is within interact range of the self body right now —
   * drives the craft/stash windows' auto-close-on-walk-away (mirrors v1's Panels.sync). */
  readonly craftTableNearby: boolean;
  readonly stashNearby: boolean;
  /** The stash's current contents, or null before the first server "stash" event this session. */
  readonly stash: readonly StashSlotSource[] | null;
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
function inventoryFields(src: HudSnapshotSource, armedThrowableSlot: number | null) {
  return {
    hotbar: hotbarSlots(src.hotbar, src.inventory),
    selectedSlot: selectedSlotIndex(src.hotbar, src.weapon),
    armedThrowableSlot,
    buffs: buffChips(src.fx),
    equippedWeaponId: src.weapon,
    inventory: inventoryRows(src.inventory, src.hotbar),
    craft: craftSnapshot(src.inventory, src.craftTableNearby),
    stash: stashSnapshot(src.inventory, src.stash, src.stashNearby),
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
    touch,
    fps,
    coords: roundedCoords(bodyPos),
    compassBearingDeg,
    stairway,
  };
}

export function buildHudSnapshot(
  src: HudSnapshotSource,
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
  return {
    health: { hp: src.hp, maxHp: src.maxHp },
    xp: { xp: src.xp, level: src.level, xpForNext: src.xpForNext },
    ...inventoryFields(src, armedThrowableSlot),
    lastToast: src.lastToast,
    toasts: [...src.toasts],
    seed: src.seed,
    floor: src.floor,
    boss: src.boss,
    party: partyRows(src.party),
    chatModel,
    contacts: [...contacts],
    interactionPrompt,
    ...statusFields(src, touch, fps, bodyPos, compassBearingDeg, stairway),
  };
}
