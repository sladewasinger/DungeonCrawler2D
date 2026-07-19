/** Fake HUD data for the gallery's HUD-on state — a presentation demo, not live game state. */

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

export interface HudFakeSnapshot {
  health: { hp: number; maxHp: number };
  hotbar: HotbarSlotData[];
  selectedSlot: number;
  armedThrowableSlot: number | null;
  buffs: BuffChipData[];
  equippedWeaponId: string | null;
  chat: ChatLineData[];
  activeChatChannel: ChatChannel;
  interactionPrompt: { key: string; label: string } | null;
  pingMs: number;
  connected: boolean;
  /** True while a previously-live connection is mid dropout/backoff (see net/socket.ts). */
  reconnecting: boolean;
  downed: boolean;
}

const EMPTY_SLOT: HotbarSlotData = { itemId: null, count: 0 };

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
  };
}
