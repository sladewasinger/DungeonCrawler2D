import type { ActiveStatusSnapshot, InvStack, ServerSnapshot } from "@dc2d/engine";
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import type { ChatPanelModel } from "../../../ui/chat/controller.js";
import type {
  CraftSnapshot,
  HudFakeSnapshot,
  CompassLandmarkTicks,
  StairwayTickData,
  StashSnapshot,
  ToastData,
} from "../../../ui/widgets/hud/core/fakeData.js";
import type { ContactData } from "../../../ui/widgets/hud/social/contactRows.js";
import type { BossBarData } from "../../../ui/widgets/hud/bars/bossBarView.js";
import { recipeRowViews } from "../../../ui/widgets/hud/windows/recipeRows.js";
import { stashRowViews } from "../../../ui/widgets/hud/windows/stashRows.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import { itemName, recipeList } from "../world/contentQueries.js";
import { partyRowsView } from "./partyRows.js";
import { inventoryFields, statusFields } from "./hudSnapshotFields.js";

export interface StashSlotSource {
  readonly item: string;
  readonly qty: number;
}


export function craftSnapshot(inventory: readonly InvStack[], nearby: boolean): CraftSnapshot {
  return { nearby, recipes: recipeRowViews(recipeList, inventory, itemName) };
}

export interface StashSnapshotSource {
  readonly inventory: readonly InvStack[];
  readonly stash: readonly StashSlotSource[] | null;
  readonly nearby: boolean;
  readonly kind?: "personal" | "loot";
}

export function stashSnapshot(source: StashSnapshotSource): StashSnapshot {
  const { inventory, stash, nearby, kind = "personal" } = source;
  return { kind, nearby, inventory: stashRowViews(inventory, itemName), entries: stashRowViews(stash ?? [], itemName) };
}

export interface HudSnapshotSource {
  readonly playerId: string | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly stamina: number; readonly maxStamina: number; readonly blocking: boolean;
  readonly staminaExhausted: boolean;
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
  readonly craftTableNearby: boolean;
  readonly stashNearby: boolean;
  readonly stash: readonly StashSlotSource[] | null;
  readonly stashKind?: "personal" | "loot";
  readonly lastToast: ToastData | null;
  readonly toasts: readonly ToastData[];
  readonly seedInputText: string | null;
  readonly floor: number;
  readonly boss: BossBarData | null;
}



export interface HudSnapshotInput {
  readonly src: HudSnapshotSource;
  readonly selectedHotbarSlot: number | null;
  readonly armedThrowableSlot: number | null;
  readonly interactionPrompt: InteractionPrompt | null;
  readonly touch: TouchVisualSnapshot | null;
  readonly fps: number;
  readonly bodyPos: { x: number; y: number; z: number };
  readonly chatModel: ChatPanelModel;
  readonly contacts: readonly ContactData[];
  readonly compassBearingDeg: number;
  readonly stairway: StairwayTickData | null;
  readonly compassLandmarks: CompassLandmarkTicks;
}

export function buildHudSnapshot(input: HudSnapshotInput): HudFakeSnapshot {
  const { src, selectedHotbarSlot, armedThrowableSlot, interactionPrompt, touch, fps, bodyPos, chatModel, contacts, compassBearingDeg, stairway, compassLandmarks } = input;
  const party = partyRowsView({ party: src.party, selfId: src.playerId, bodyPos, viewBearingDeg: compassBearingDeg });
  return {
    health: { hp: src.hp, maxHp: src.maxHp },
    stamina: { stamina: src.stamina, maxStamina: src.maxStamina, blocking: src.blocking },
    xp: { xp: src.xp, level: src.level, xpForNext: src.xpForNext },
    ...inventoryFields(src, selectedHotbarSlot, armedThrowableSlot),
    lastToast: src.lastToast,
    toasts: [...src.toasts],
    seedInputText: src.seedInputText,
    floor: src.floor,
    biome: null,
    headingDeg: 0,
    boss: src.boss,
    party: party.rows,
    partySelfLeader: party.selfIsLeader,
    chatModel,
    contacts: [...contacts],
    interactionPrompt,
    ...statusFields({ src, touch, fps, bodyPos, compassBearingDeg, stairway, compassLandmarks }),
  };
}
