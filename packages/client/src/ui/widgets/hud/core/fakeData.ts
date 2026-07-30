import type { BiomeKind } from "@dc2d/engine";
import type { TouchVisualSnapshot } from "../../../../input/touch/index.js";
import { inputModality } from "../../../../input/controls/inputModality.js";
import type { ChatPanelModel } from "../../../chat/controller.js";
import type { ContextualActionHint } from "../../../actionHelp/actionHelp.js";
import type { ContactData } from "../social/contactRows.js";
import type { PartyRowData } from "../social/partyFrames.js";
import type { BossBarData } from "../bars/bossBarView.js";
import type { RecipeRowView } from "../windows/recipeRows.js";
import type { StashRowView } from "../windows/stashRows.js";
import type { XpBarData } from "../bars/xpBarView.js";
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
export type InventoryCategory = "weapons" | "usables" | "materials";
export interface InventoryRowData {
    itemId: string;
    name: string;
    qty: number;
    category: InventoryCategory;
    boundSlot: number | null;
    canUse: boolean;
    canHotbar: boolean;
    flavor?: string | undefined;
}
export interface TileCoords {
    x: number;
    y: number;
    z: number;
}
export interface CraftSnapshot {
    nearby: boolean;
    recipes: RecipeRowView[];
}
export interface StashSnapshot {
    kind: "personal" | "loot";
    nearby: boolean;
    inventory: StashRowView[];
    entries: StashRowView[];
}
export interface ToastData {
    msg: string;
    until: number;
}
export interface StairwayTickData {
    screenBearingDeg: number;
    near: boolean;
}
export interface CompassTargetTickData {
    screenBearingDeg: number;
}
export interface CompassLandmarkTicks {
    safeRoom: CompassTargetTickData | null;
    miniBossArena: CompassTargetTickData | null;
}
export interface HudFakeSnapshot {
    health: {
        hp: number;
        maxHp: number;
    };
    stamina: {
        stamina: number;
        maxStamina: number;
        blocking: boolean;
    };
    xp: XpBarData;
    hotbar: HotbarSlotData[];
    selectedSlot: number;
    armedThrowableSlot: number | null;
    buffs: BuffChipData[];
    equippedWeaponId: string | null;
    inventory: InventoryRowData[];
    craft: CraftSnapshot;
    stash: StashSnapshot;
    lastToast: ToastData | null;
    toasts: ToastData[];
    seedInputText: string | null;
    floor: number;
    biome: BiomeKind | null;
    headingDeg: number;
    boss: BossBarData | null;
    party: PartyRowData[];
    partySelfLeader: boolean;
    chatModel: ChatPanelModel;
    contacts: ContactData[];
    interactionPrompt: {
        key: string;
        label: string;
    } | null;
    actionHints: ContextualActionHint[];
    pingMs: number;
    connected: boolean;
    reconnecting: boolean;
    reconnectAttempts: number;
    downed: boolean;
    dead: boolean;
    respawnRemainingSec: number;
    giveUpHoldProgress: number;
    downedRemainingSec: number;
    reviveProgress: number;
    reviverName: string | null;
    touch: TouchVisualSnapshot | null;
    fps: number;
    coords: TileCoords;
    compassBearingDeg: number;
    stairway: StairwayTickData | null;
    compassLandmarks: CompassLandmarkTicks;
}
const EMPTY_SLOT: HotbarSlotData = { itemId: null, count: 0 };
const FAKE_INVENTORY: InventoryRowData[] = [{ itemId: "sword", name: "Rusty Sword", qty: 1, category: "weapons", boundSlot: 0, canUse: false, canHotbar: false }, { itemId: "knife", name: "Knife", qty: 1, category: "weapons", boundSlot: null, canUse: false, canHotbar: false }, { itemId: "hammer", name: "Heavy Hammer", qty: 1, category: "weapons", boundSlot: 4, canUse: false, canHotbar: false }, { itemId: "torch", name: "Torch", qty: 2, category: "usables", boundSlot: null, canUse: false, canHotbar: true }, { itemId: "bandage", name: "Bandage", qty: 3, category: "usables", boundSlot: 1, canUse: true, canHotbar: true }, { itemId: "water-flask", name: "Water Flask", qty: 2, category: "usables", boundSlot: 2, canUse: true, canHotbar: true }, { itemId: "vodka-bottle", name: "Vodka Bottle", qty: 1, category: "usables", boundSlot: 3, canUse: false, canHotbar: true }, { itemId: "raw-meat", name: "Raw Meat", qty: 4, category: "usables", boundSlot: null, canUse: true, canHotbar: true }, { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null, canUse: false, canHotbar: false, flavor: "Absorbent. Slightly cursed. Mostly the first thing." }, { itemId: "stick", name: "Stick", qty: 5, category: "materials", boundSlot: null, canUse: false, canHotbar: false, flavor: "The dungeon's starter weapon, technically. Don't." },];
const FAKE_CHAT_MODEL: ChatPanelModel = { tabs: [{ id: "global", active: false, unread: true, dim: false }, { id: "local", active: true, unread: false, dim: false }, { id: "party", active: false, unread: false, dim: false }, { id: "dm", active: false, unread: false, dim: true },], lines: [{ channel: "local", author: "Wren", text: "watch the spikes" }, { channel: "local", author: "Grief", text: "W".repeat(120) }, { channel: "local", author: "system", text: "Crawler #2 has entered Floor 1. Odds of survival have been posted." }, { channel: "party", author: "you", text: "grabbed the key" },], };
const FAKE_CONTACTS: ContactData[] = [{ name: "Wren", online: true }, { name: "Rex", online: false },];
const FAKE_PARTY: PartyRowData[] = [{ id: "p2", name: "Wren", hp: 22, maxHp: 30, downed: false, arrow: "↗", distance: 12 }, { id: "p3", name: "Rex", hp: 1, maxHp: 30, downed: true, arrow: "←", distance: 28 },];
const FAKE_CRAFT: CraftSnapshot = { nearby: true, recipes: [{ recipeId: "bandage", outputId: "bandage", outputName: "Bandage", outputQty: 1, ingredients: [{ itemId: "rag", name: "Rag", have: 6, need: 2, met: true }], craftable: true, }, { recipeId: "torch", outputId: "torch", outputName: "Torch", outputQty: 1, ingredients: [{ itemId: "stick", name: "Stick", have: 0, need: 1, met: false }, { itemId: "rag", name: "Rag", have: 6, need: 1, met: true },], craftable: false, },], };
const FAKE_STASH: StashSnapshot = { kind: "personal", nearby: true, inventory: [{ index: 0, itemId: "sword", name: "Rusty Sword", qty: 1 }, { index: 1, itemId: "rag", name: "Rag", qty: 6 },], entries: [{ index: 0, itemId: "bandage", name: "Bandage", qty: 2 }], };
const FAKE_HOTBAR: HotbarSlotData[] = [{ itemId: "sword", count: 1 }, { itemId: "bandage", count: 3 }, { itemId: "water-flask", count: 2 }, { itemId: "vodka-bottle", count: 1 }, { itemId: "hammer", count: 1 }, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT,];
const FAKE_BUFFS: BuffChipData[] = [{ statusId: "on-fire", kind: "debuff", remainingSec: 3.2, durationSec: 5 }, { statusId: "regenerating", kind: "buff", remainingSec: 12, durationSec: 20 }];
export function fakeHudSnapshot(downed: boolean): HudFakeSnapshot { return { health: { hp: 24, maxHp: 48 }, stamina: { stamina: 72, maxStamina: 100, blocking: false }, xp: { xp: 220, level: 3, xpForNext: 80 }, hotbar: FAKE_HOTBAR, selectedSlot: 0, armedThrowableSlot: 3, buffs: FAKE_BUFFS, equippedWeaponId: "sword", inventory: FAKE_INVENTORY, craft: FAKE_CRAFT, stash: FAKE_STASH, lastToast: null, toasts: [], seedInputText: "e2e-world", floor: 1, biome: "ruins", headingDeg: 315, boss: null, party: FAKE_PARTY, partySelfLeader: false, chatModel: FAKE_CHAT_MODEL, contacts: FAKE_CONTACTS, interactionPrompt: { key: "R", label: "pick up" }, actionHints: [{ action: "attack", key: "LMB", touchKey: "ATTACK", label: "Attack with Rusty Sword" }], pingMs: 42, connected: true, reconnecting: false, reconnectAttempts: 0, downed, dead: false, respawnRemainingSec: 5, giveUpHoldProgress: 0.55, downedRemainingSec: 15, reviveProgress: 0, reviverName: null, touch: inputModality.current === "touch" ? { stick: null, buttons: { attack: false, jump: false, interact: false } } : null, fps: 60, coords: { x: 128, y: -64, z: 2.5 }, compassBearingDeg: 0, stairway: { screenBearingDeg: 135, near: false }, compassLandmarks: { safeRoom: { screenBearingDeg: 210 }, miniBossArena: { screenBearingDeg: 40 } }, };
}
